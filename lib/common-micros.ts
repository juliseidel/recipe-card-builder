// Quick-add micronutrients with typical amount presets
// User clicks "+ Vitamin C" → gets a row prefilled with sensible defaults

export type MicroQuickPick = {
  name: string;
  amount: string;
  pctDaily: number;
};

export const microQuickPicks: MicroQuickPick[] = [
  { name: "Vitamin C", amount: "60 mg", pctDaily: 75 },
  { name: "Vitamin A", amount: "800 µg", pctDaily: 100 },
  { name: "Vitamin D", amount: "5 µg", pctDaily: 100 },
  { name: "Vitamin E", amount: "12 mg", pctDaily: 100 },
  { name: "Vitamin K", amount: "75 µg", pctDaily: 100 },
  { name: "Vitamin B6", amount: "1,4 mg", pctDaily: 100 },
  { name: "Vitamin B12", amount: "2,5 µg", pctDaily: 100 },
  { name: "Folat", amount: "200 µg", pctDaily: 100 },
  { name: "Niacin", amount: "16 mg", pctDaily: 100 },
  { name: "Riboflavin", amount: "1,4 mg", pctDaily: 100 },
  { name: "Calcium", amount: "800 mg", pctDaily: 100 },
  { name: "Eisen", amount: "14 mg", pctDaily: 100 },
  { name: "Magnesium", amount: "375 mg", pctDaily: 100 },
  { name: "Kalium", amount: "2000 mg", pctDaily: 100 },
  { name: "Phosphor", amount: "700 mg", pctDaily: 100 },
  { name: "Zink", amount: "10 mg", pctDaily: 100 },
  { name: "Selen", amount: "55 µg", pctDaily: 100 },
  { name: "Mangan", amount: "2 mg", pctDaily: 100 },
  { name: "Omega-3", amount: "1,5 g", pctDaily: 0 },
];
