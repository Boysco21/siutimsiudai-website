#!/usr/bin/env python3
"""
calculate_nutrition.py - daily nutritional target calculator.

Mifflin-St Jeor BMR, activity-scaled TDEE, a flat goal adjustment, a macro split,
and a micronutrient / health baseline. Pure standard library, no dependencies.

Usage:
    python3 calculate_nutrition.py
    python3 calculate_nutrition.py --gender Female --age 30 --weight 60 \
        --height 165 --activity Light --goal "Fat Loss"
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass

# --- Reference tables -------------------------------------------------------

ACTIVITY_MULTIPLIERS = {
    "Sedentary": 1.2,
    "Light": 1.375,
    "Moderate": 1.55,
    "Heavy": 1.725,
}

# Flat kcal adjustment applied to TDEE for the chosen goal.
GOAL_DELTAS = {
    "Fat Loss": -400,
    "Maintenance": 0,
    "Muscle Gain": 300,
}

# Grams of protein per kg of body weight.
PROTEIN_PER_KG = {
    "Fat Loss": 2.0,
    "Maintenance": 1.8,
    "Muscle Gain": 2.0,
}

FAT_CALORIE_SHARE = 0.25       # 25% of the daily target comes from fat
FIBER_PER_1000_KCAL = 14       # grams of fibre per 1,000 kcal
SODIUM_BASELINE_MG = 2300      # baseline sodium target

# Generic RDA reminders (not personalised) shown alongside the computed baselines.
VITAMIN_RDA = [
    ("Vitamin D", "600 IU"),
    ("Vitamin B12", "2.4 mcg"),
    ("Vitamin C", "90 mg"),
    ("Calcium", "1000 mg"),
    ("Potassium", "3500 mg"),
]

CAL_PER_G = {"protein": 4, "carbs": 4, "fat": 9}


@dataclass
class Profile:
    gender: str
    age: int
    weight_kg: float
    height_cm: float
    activity: str
    goal: str


# --- Core maths -------------------------------------------------------------

def bmr_mifflin_st_jeor(p: Profile) -> float:
    """Basal metabolic rate in kcal/day (Mifflin-St Jeor)."""
    base = (10 * p.weight_kg) + (6.25 * p.height_cm) - (5 * p.age)
    return base + 5 if p.gender == "Male" else base - 161


def calculate(p: Profile) -> dict:
    bmr = bmr_mifflin_st_jeor(p)
    tdee = bmr * ACTIVITY_MULTIPLIERS[p.activity]
    target = tdee + GOAL_DELTAS[p.goal]

    protein_g = PROTEIN_PER_KG[p.goal] * p.weight_kg
    protein_cal = protein_g * CAL_PER_G["protein"]

    fat_cal = target * FAT_CALORIE_SHARE
    fat_g = fat_cal / CAL_PER_G["fat"]

    # Carbohydrates take whatever calories are left after protein and fat.
    carbs_cal = target - protein_cal - fat_cal
    carbs_g = carbs_cal / CAL_PER_G["carbs"]

    return {
        "bmr": bmr,
        "activity_multiplier": ACTIVITY_MULTIPLIERS[p.activity],
        "tdee": tdee,
        "goal_delta": GOAL_DELTAS[p.goal],
        "target": target,
        "protein_g": protein_g,
        "protein_cal": protein_cal,
        "fat_g": fat_g,
        "fat_cal": fat_cal,
        "carbs_g": carbs_g,
        "carbs_cal": carbs_cal,
        "fiber_g": (target / 1000) * FIBER_PER_1000_KCAL,
        "sodium_mg": SODIUM_BASELINE_MG,
        "iron_mg": 8 if p.gender == "Male" else 18,
    }


# --- Presentation -----------------------------------------------------------

WIDTH = 54


def _rule(char: str = "-") -> str:
    return char * WIDTH


def _section(title: str) -> str:
    return f"\n{title}\n{_rule('=')}"


def render(p: Profile, r: dict) -> str:
    lines: list[str] = []
    lines.append(_rule("="))
    lines.append("DAILY NUTRITIONAL TARGETS".center(WIDTH))
    lines.append(_rule("="))
    lines.append(
        f"{p.gender}, {p.age} yrs  |  {round(p.weight_kg)} kg  |  "
        f"{round(p.height_cm)} cm"
    )
    lines.append(f"Activity: {p.activity}  |  Goal: {p.goal}")

    lines.append(_section("ENERGY SUMMARY"))
    lines.append(f"{'BMR (Mifflin-St Jeor)':<34}{round(r['bmr']):>12} kcal")
    lines.append(
        f"{'Activity multiplier':<34}{'x ' + format(r['activity_multiplier'], '.3f'):>14}"
    )
    lines.append(f"{'TDEE (maintenance)':<34}{round(r['tdee']):>12} kcal")
    delta = r["goal_delta"]
    lines.append(f"{'Goal adjustment':<34}{(f'{delta:+d}'):>12} kcal")
    lines.append(_rule())
    lines.append(f"{'DAILY CALORIE TARGET':<34}{round(r['target']):>12} kcal")

    lines.append(_section("MACRONUTRIENT TARGETS (GRAMS & CALORIES)"))
    lines.append(f"{'Macro':<14}{'Grams':>10}{'Calories':>14}{'% kcal':>10}")
    lines.append(_rule())
    for name, g, cal in (
        ("Protein", r["protein_g"], r["protein_cal"]),
        ("Fat", r["fat_g"], r["fat_cal"]),
        ("Carbohydrates", r["carbs_g"], r["carbs_cal"]),
    ):
        pct = (cal / r["target"] * 100) if r["target"] else 0
        lines.append(
            f"{name:<14}{round(g):>8} g{round(cal):>12} kcal{round(pct):>8} %"
        )

    lines.append(_section("MICRONUTRIENT / HEALTH BASELINES"))
    lines.append(f"{'Fibre':<34}{round(r['fiber_g']):>12} g")
    lines.append(f"{'Sodium (baseline)':<34}{round(r['sodium_mg']):>12} mg")
    lines.append(f"{'Iron':<34}{round(r['iron_mg']):>12} mg")
    lines.append("")
    lines.append("General RDA reminders (not personalised):")
    for name, amount in VITAMIN_RDA:
        lines.append(f"  - {name:<20}{amount:>12}")

    lines.append(_rule("="))
    lines.append(
        "Estimates for general guidance, not medical advice. See a doctor"
    )
    lines.append("or dietitian for personal targets.")
    lines.append(_rule("="))
    return "\n".join(lines)


# --- CLI --------------------------------------------------------------------

def parse_args() -> Profile:
    parser = argparse.ArgumentParser(
        description="Calculate daily nutritional targets."
    )
    parser.add_argument("--gender", choices=["Male", "Female"], default="Male")
    parser.add_argument("--age", type=int, default=25)
    parser.add_argument("--weight", type=float, default=75, help="kilograms")
    parser.add_argument("--height", type=float, default=175, help="centimetres")
    parser.add_argument(
        "--activity",
        choices=list(ACTIVITY_MULTIPLIERS),
        default="Moderate",
    )
    parser.add_argument(
        "--goal",
        choices=list(GOAL_DELTAS),
        default="Maintenance",
    )
    a = parser.parse_args()
    return Profile(a.gender, a.age, a.weight, a.height, a.activity, a.goal)


def main() -> None:
    profile = parse_args()
    print(render(profile, calculate(profile)))


if __name__ == "__main__":
    main()
