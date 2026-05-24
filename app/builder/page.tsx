import { BuilderClient } from "./BuilderClient";
import { sampleRecipes } from "@/data/sample-recipes";

export const metadata = {
  title: "Builder · Recipe Card Builder",
};

export default function BuilderPage() {
  return <BuilderClient initialRecipe={sampleRecipes[0]!} />;
}
