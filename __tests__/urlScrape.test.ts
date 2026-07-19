import {
  parseRecipeFromHtml,
  parseIngredientLine,
  parseInstructions,
  parseIsoDurationMinutes,
  parseServings,
  findRecipeNode,
} from "@/services/urlScrapeService";

// Wrap a Recipe node in the @graph shape most WordPress/Yoast recipe sites emit, then
// embed it in a minimal HTML document with the ld+json script tag.
function htmlWithGraph(recipe: object): string {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [{ "@type": "WebPage", name: "A page" }, { "@type": "Organization" }, recipe],
  };
  return `<!doctype html><html><head><title>x</title>
<script type="application/ld+json">${JSON.stringify(graph)}</script>
</head><body><h1>x</h1></body></html>`;
}

const CHEESEBURGER = {
  "@type": "Recipe",
  name: "Classic Cheeseburger",
  recipeYield: ["4", "4 servings"],
  totalTime: "PT30M",
  recipeIngredient: [
    "1 lb ground beef",
    "2 tablespoons butter",
    "1/2 teaspoon salt",
    "½ cup milk", // ½ cup milk
    "4 hamburger buns",
    "Salt and pepper to taste",
  ],
  recipeInstructions: [
    { "@type": "HowToStep", text: "Form the beef into patties." },
    { "@type": "HowToStep", text: "Grill for 4 minutes per side." },
    { "@type": "HowToStep", text: "Toast the buns and assemble." },
  ],
};

describe("URL scraper: full-page parse", () => {
  const url = "https://www.recipetineats.com/cheeseburger-recipe/";
  const recipe = parseRecipeFromHtml(htmlWithGraph(CHEESEBURGER), url);

  test("pulls the Recipe node out of @graph and reads the headline fields", () => {
    expect(recipe.title).toBe("Classic Cheeseburger");
    expect(recipe.servings).toBe(4);
    expect(recipe.totalMinutes).toBe(30);
    expect(recipe.sourceUrl).toBe(url);
  });

  test("keeps every ingredient line, quantified or not", () => {
    expect(recipe.ingredients).toHaveLength(6);
    const taste = recipe.ingredients[5];
    expect(taste.name).toBe("Salt and pepper to taste");
    expect(taste.quantity).toBe(0);
    expect(taste.unit).toBe("piece");
  });

  test("numbers the steps and reads an in-step timer", () => {
    expect(recipe.steps).toHaveLength(3);
    expect(recipe.steps[1].instruction).toBe("Grill for 4 minutes per side.");
    expect(recipe.steps[1].durationSeconds).toBe(240);
    expect(recipe.steps[0].durationSeconds).toBeNull();
  });

  test("falls back to the English text for the Chinese fields", () => {
    expect(recipe.titleZh).toBe("Classic Cheeseburger");
    expect(recipe.ingredients[0].nameZh).toBe(recipe.ingredients[0].name);
  });
});

describe("URL scraper: ingredient lines", () => {
  test("pounds normalise to grams and keep the display unit", () => {
    const ing = parseIngredientLine("1 lb ground beef");
    expect(ing).toMatchObject({ unit: "g", quantity: 453.59, name: "ground beef", displayUnit: "lb" });
  });

  test("a spoon of a dry good reads in grams, not millilitres", () => {
    // Butter and salt are weighed in metric, so a tbsp/tsp measure resolves to g.
    expect(parseIngredientLine("2 tablespoons butter")).toMatchObject({
      unit: "g",
      quantity: 30,
      name: "butter",
    });
    expect(parseIngredientLine("1/2 teaspoon salt")).toMatchObject({
      unit: "g",
      quantity: 2.5,
      name: "salt",
    });
  });

  test("a cup of a liquid stays in millilitres", () => {
    expect(parseIngredientLine("½ cup milk")).toMatchObject({
      unit: "ml",
      quantity: 120,
      name: "milk",
    });
  });

  test("a bare count with no unit stays as pieces", () => {
    expect(parseIngredientLine("4 hamburger buns")).toMatchObject({
      unit: "piece",
      quantity: 4,
      name: "hamburger buns",
    });
  });

  test("an unquantified line keeps quantity 0 and the whole line as the name", () => {
    expect(parseIngredientLine("Salt and pepper to taste")).toMatchObject({
      unit: "piece",
      quantity: 0,
      name: "Salt and pepper to taste",
    });
  });

  test("a mixed number adds the fraction to the integer", () => {
    // 1.5 cups -> 360 mL, then flour's solid nature reads it as grams.
    expect(parseIngredientLine("1 1/2 cups flour")).toMatchObject({
      unit: "g",
      quantity: 360,
      name: "flour",
    });
  });

  test("a liquid written by weight flips to millilitres", () => {
    expect(parseIngredientLine("250 g milk")).toMatchObject({
      unit: "ml",
      quantity: 250,
      name: "milk",
    });
  });

  test("a liquid measured in cups stays millilitres", () => {
    expect(parseIngredientLine("1 cup soy sauce")).toMatchObject({
      unit: "ml",
      quantity: 240,
      name: "soy sauce",
    });
  });

  test("a spoon of an unclassified ingredient is treated as a dry good in grams", () => {
    expect(parseIngredientLine("1 tbsp curry paste")).toMatchObject({
      unit: "g",
      quantity: 15,
      name: "curry paste",
    });
  });

  test("a range collapses to its lower bound", () => {
    expect(parseIngredientLine("1-2 cloves garlic")).toMatchObject({
      unit: "piece",
      quantity: 1,
      name: "cloves garlic",
    });
  });

  test("a dual metric/imperial amount keeps the primary unit and a clean name", () => {
    expect(parseIngredientLine("600 g / 1.2 lb beef mince")).toMatchObject({
      unit: "g",
      quantity: 600,
      name: "beef mince",
    });
  });

  test("strips parenthetical notes so the name stays simple", () => {
    expect(
      parseIngredientLine("600 g / 1.2 lb beef mince (ground beef) (, at least 20% fat (Note 1 for quality))"),
    ).toMatchObject({ unit: "g", quantity: 600, name: "beef mince" });
    expect(parseIngredientLine('4 soft burger buns or rolls (, around 10cm/4" wide (Note 2))')).toMatchObject({
      unit: "piece",
      quantity: 4,
      name: "soft burger buns or rolls",
    });
    // A line that is only notes after the food word still keeps the food.
    expect(parseIngredientLine("2 eggs (large)")).toMatchObject({ quantity: 2, name: "eggs" });
  });
});

describe("URL scraper: field parsers", () => {
  test("ISO 8601 durations convert to minutes", () => {
    expect(parseIsoDurationMinutes("PT1H30M")).toBe(90);
    expect(parseIsoDurationMinutes("PT30M")).toBe(30);
    expect(parseIsoDurationMinutes("PT45S")).toBe(1);
    expect(parseIsoDurationMinutes("")).toBeNull();
    expect(parseIsoDurationMinutes("banana")).toBeNull();
    expect(parseIsoDurationMinutes(undefined)).toBeNull();
  });

  test("recipeYield is read from numbers, strings, and arrays", () => {
    expect(parseServings(["4", "4 servings"])).toBe(4);
    expect(parseServings("6 servings")).toBe(6);
    expect(parseServings(3)).toBe(3);
    expect(parseServings(undefined)).toBe(2);
    expect(parseServings(0)).toBe(2);
  });

  test("HowToSection instructions flatten into a flat step list", () => {
    const steps = parseInstructions([
      {
        "@type": "HowToSection",
        name: "Prep",
        itemListElement: [
          { "@type": "HowToStep", text: "Chop the onion." },
          { "@type": "HowToStep", text: "Mince the garlic." },
        ],
      },
      {
        "@type": "HowToSection",
        name: "Cook",
        itemListElement: [{ "@type": "HowToStep", text: "Simmer for 20 minutes." }],
      },
    ]);
    expect(steps.map((s) => s.instruction)).toEqual([
      "Chop the onion.",
      "Mince the garlic.",
      "Simmer for 20 minutes.",
    ]);
    expect(steps[2].durationSeconds).toBe(1200);
    expect(steps[2].stepNumber).toBe(3);
  });

  test("a single instruction blob splits into sentences", () => {
    const steps = parseInstructions("Preheat the oven. Bake for ten minutes. Let it rest.");
    expect(steps).toHaveLength(3);
    expect(steps[0].instruction).toBe("Preheat the oven.");
  });
});

describe("URL scraper: step cleanup", () => {
  test("lifts a section label so the step opens on its verb", () => {
    const steps = parseInstructions([
      { "@type": "HowToStep", text: "Patties: Separate the beef into 4 equal portions." },
      { "@type": "HowToStep", text: "For the sauce: Whisk the mayo and ketchup together." },
    ]);
    expect(steps[0].instruction).toBe("Separate the beef into 4 equal portions.");
    expect(steps[1].instruction).toBe("Whisk the mayo and ketchup together.");
  });

  test("drops leading step numbering and bullets", () => {
    const steps = parseInstructions([
      { "@type": "HowToStep", text: "1. Preheat the oven to 200C." },
      { "@type": "HowToStep", text: "Step 2: Bake for 20 minutes." },
    ]);
    expect(steps[0].instruction).toBe("Preheat the oven to 200C.");
    expect(steps[1].instruction).toBe("Bake for 20 minutes.");
    expect(steps[1].durationSeconds).toBe(1200);
  });

  test("peels a parenthetical aside but keeps the timer inside it", () => {
    const steps = parseInstructions("Simmer the sauce (about 20 minutes) until thickened.");
    expect(steps[0].instruction).toBe("Simmer the sauce until thickened.");
    expect(steps[0].durationSeconds).toBe(1200);
  });

  test("leaves a clause with a mid-sentence colon intact", () => {
    const steps = parseInstructions([
      { "@type": "HowToStep", text: "Meanwhile, cook the pasta: stir occasionally." },
    ]);
    expect(steps[0].instruction).toBe("Meanwhile, cook the pasta: stir occasionally.");
  });

  test("removes a whole parenthetical sentence without leaving a double period", () => {
    const steps = parseInstructions([
      { "@type": "HowToStep", text: "Toast the buns until golden. (If using a BBQ, grill them). Set aside." },
    ]);
    expect(steps[0].instruction).toBe("Toast the buns until golden. Set aside.");
  });

  test("lifts a label even when the label word repeats the action verb", () => {
    const steps = parseInstructions([
      { "@type": "HowToStep", text: "Cook: Cook the patties for 2 minutes per side." },
    ]);
    expect(steps[0].instruction).toBe("Cook the patties for 2 minutes per side.");
  });
});

describe("URL scraper: robustness", () => {
  test("a plain Recipe object (no @graph wrapper) is still found", () => {
    const node = findRecipeNode({ "@type": "Recipe", name: "Soup" });
    expect(node?.name).toBe("Soup");
  });

  test("a page with no Recipe JSON-LD throws", () => {
    const html = "<html><head></head><body>No recipe here</body></html>";
    expect(() => parseRecipeFromHtml(html, "https://example.com")).toThrow("no_recipe_jsonld");
  });

  test("recovers a Recipe block with raw control characters inside a string", () => {
    // Some plugins (e.g. inspiredtaste.net) leave literal newlines/carriage returns inside
    // JSON-LD string values, which strict JSON.parse rejects. The scraper should escape the
    // stray control chars and still read the recipe instead of losing the whole block.
    const recipeJson =
      '{"@context":"https://schema.org","@type":"Recipe","name":"Carrot Cake",' +
      '"author":{"@type":"Person","name":"Jane\r\nDoe\nFounder of Inspired Taste"},' +
      '"recipeIngredient":["2 cups flour","3 eggs"],' +
      '"recipeInstructions":[{"@type":"HowToStep","text":"Mix and bake."}]}';
    const html =
      "<!doctype html><html><head>" +
      `<script type="application/ld+json">${recipeJson}</script>` +
      "</head><body></body></html>";
    const recipe = parseRecipeFromHtml(html, "https://example.com/carrot");
    expect(recipe.title).toBe("Carrot Cake");
    expect(recipe.ingredients).toHaveLength(2);
    expect(recipe.steps[0].instruction).toBe("Mix and bake.");
  });
});
