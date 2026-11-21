// WEB-1801 (M8.2b): the teacher's switch "Dopušten uvoz" in the assignment wizard.
export const importAllowedHr = {
  label: "Dopušten uvoz",
  hint: "Student smije uvesti postojeći tekst iz DOCX ili PDF datoteke. Prije umetanja vidi pregled i potvrđuje uvoz; uvezeni tekst ostaje označen kao uvezen. Kasnije se uvoz u novoj verziji zadatka smije samo isključiti.",
  off: "Uvoz nije dopušten: student ne vidi gumb za uvoz.",
} as const;
