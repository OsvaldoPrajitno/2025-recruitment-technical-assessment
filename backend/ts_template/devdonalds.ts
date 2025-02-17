import express, { Request, Response } from "express";

process.env.NODE_ENV = 'production'; // to prevent stack trace from displaying when throwing errors

// ==== Type Definitions, feel free to add or modify ==========================
interface cookbookEntry {
  name: string;
  type: string;
}

interface requiredItem {
  name: string;
  quantity: number;
}

interface recipe extends cookbookEntry {
  requiredItems: requiredItem[];
}

interface ingredient extends cookbookEntry {
  cookTime: number;
}

interface summary {
  name: string,
  cookTime: number,
  ingredients: requiredItem[]
}

class ItemNotFoundError extends Error {
  statusCode: number

  constructor(message: string, status: number) {
    super(message); // Call the constructor of the base class `Error`
    this.statusCode = status;

    Object.setPrototypeOf(this, ItemNotFoundError.prototype);
  }
}

// =============================================================================
// ==== HTTP Endpoint Stubs ====================================================
// =============================================================================
const app = express();
app.use(express.json());

// Store your recipes here!
const cookbook: any = [];

// Task 1 helper (don't touch)
app.post("/parse", (req:Request, res:Response) => {
  const { input } = req.body;

  const parsed_string = parse_handwriting(input)
  if (parsed_string == null) {
    res.status(400).send("this string is cooked");
    return;
  } 
  res.json({ msg: parsed_string });
  return;
  
});

// returns true if format is correct
const task1FormatChecker = (name: string): boolean => {
  if (/[^a-zA-Z\s]|-|_|\s{2,}/.test(name)) return false;
  
  return !name.split(" ").some(word => /[a-z]/.test(word.charAt(0)) || /[A-Z]/.test(word.slice(1)));
}

// [TASK 1] ====================================================================
// Takes in a recipeName and returns it in a form that 
const parse_handwriting = (recipeName: string): string | null => {
  if (recipeName.length < 1) return null;

  if (task1FormatChecker(recipeName)) {
    return recipeName;
  }

  const actuallyReadable = recipeName
    .replace(/-|_/g, " ")
    .replace(/[^a-zA-Z\s]/g, '')
    .replace(/\s{2,}/, " ")
    .trim()
    .toLowerCase();

  const words = actuallyReadable
    .split(" ")
    .map(word => {
      return word.charAt(0).toUpperCase() + word.slice(1);
    });

  const ricipi = words.join(" ");
  
  return ricipi.length > 0? ricipi: null;
}


// Terrible way to check for duplicate names in requiredItems list
// Returns true if duplicate name found
const task2DuplicateChecker = (inputArray: requiredItem[]): boolean => {
  if (inputArray.length <= 1) return false;

  // sort array
  inputArray.sort((a, b) => {
    if (a.name > b.name) {
      return 1;
    } else {
      return -1
    }
  })

  // Check two adjacent object for the same name 
  for (let i = 0; i < inputArray.length - 1; i++) {
    if (inputArray[i].name === inputArray[i + 1].name) {
      return true;
    }
  }

  return false
}

// [TASK 2] ====================================================================
// Endpoint that adds a CookbookEntry to your magical cookbook
app.post("/entry", (req:Request, res:Response) => {
  const { type, name, requiredItems, cookTime } = req.body;

  if (type !== "recipe" && type !== "ingredient") return res.status(400).json("Invalid: Type Can Only Be Recipe or Ingrdient");
  if (cookbook.some((entry: cookbookEntry) => entry.name === name)) return res.status(400).json("A Recipe With That Name Already Exists");
  

  if (type === "recipe") {
    if (task2DuplicateChecker(requiredItems)) return res.status(400).json("Required Items Contain Duplicate Names");

    cookbook.push({
      type: type,
      name: name,
      requiredItems: requiredItems
    })
  } else {
    if (cookTime < 0) return res.status(400).json("Invalid: Negative Cooktime");
    
    cookbook.push({
      type: type,
      name: name,
      cookTime: cookTime
    })
  }

  res.sendStatus(200);

  console.log(cookbook)
});


const combineTwoSummaries = (parentSummary: summary, load: summary, loadQtty: number) => {
  parentSummary.cookTime += load.cookTime * loadQtty;

  load.ingredients.forEach(loadIngdt => {
    const target = parentSummary.ingredients.find(parentIngdt => parentIngdt.name === loadIngdt.name);

    if (target) {
      target.quantity += loadIngdt.quantity * loadQtty;
    } else {
      parentSummary.ingredients.push({
        name: loadIngdt.name,
        quantity: loadIngdt.quantity * loadQtty
      });
    }
  })
}

// Traverse a recipe's required items recursively until it finds an ingredient, then returns the summary to be combined
const unravelRecipe = (item: requiredItem): summary => {
  const entry: ingredient|recipe = cookbook.find(( {name} ) => name === item.name);
  
  if (!entry) {
    throw new ItemNotFoundError("Ingredient/Recipe Not Found in Cookbook", 400);
  }

  const summary: summary = {
    name: entry.name,
    cookTime: 0,
    ingredients: []
  }

  if ('cookTime' in entry) {
    summary.cookTime = entry.cookTime;
    summary.ingredients.push({
      name: entry.name,
      quantity: 1
    })

  } else {
  
    for (const i of entry.requiredItems) {
      const result = unravelRecipe(i);
      combineTwoSummaries(summary, result, i.quantity);
    }
  }

  return summary;
}

// [TASK 3] ====================================================================
// Endpoint that returns a summary of a recipe that corresponds to a query name
app.get("/summary", (req:Request, res:Request) => {
  const recipeName = req.query.name;
  const recipe: recipe = cookbook.find((entry: cookbookEntry) => entry.name === recipeName && entry.type === "recipe");

  if (!recipe) return res.status(400).send("Recipe Not Found");

  const menuItem: requiredItem = {name: recipe.name, quantity: 1};
  const summary: summary = unravelRecipe(menuItem);
  

  res.status(200).send(JSON.stringify(summary))
});

// =============================================================================
// ==== DO NOT TOUCH ===========================================================
// =============================================================================
const port = 8080;
app.listen(port, () => {
  console.log(`Running on: http://127.0.0.1:8080`);
});
