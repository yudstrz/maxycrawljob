import assert from "node:assert/strict";
import { isIntern } from "./intern.ts";

for (const t of ["Software Engineer Intern", "Magang Marketing", "Summer Internship 2027", "Praktikant (m/w/d)", "Werkstudent Backend"])
  assert(isIntern(t), t);
for (const t of ["Internal Tools Engineer", "International Sales Manager", "Senior Backend Engineer"])
  assert(!isIntern(t), t);
console.log("ok");
