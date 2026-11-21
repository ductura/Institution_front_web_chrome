type Step = [title: string, description: string];

export const onboardingHr = {
  help: "Pomoć",
  title: "Prvi koraci",
  duration: "Oko 2 minute",
  progress: "Korak {step} od {total}",
  previous: "Natrag",
  next: "Dalje",
  skip: "Preskoči vodič",
  finish: "Završi vodič",
  steps: [
    ["Pisanje i oblikovanje", "Pišite na listu. Na traci iznad lista odaberite stil odlomka ili naslov, oblikujte odabrani tekst i poništite zadnju izmjenu."],
    ["Naredbe u tekstu", "Na početku retka upišite / za popis naredbi. Strelicama se pomičete kroz prijedloge, a tipkom Enter odabirete naredbu."],
    ["Spremanje rada", "Izmjene se spremaju dok pišete. Na dnu editora provjerite je li rad spremljen na uređaju ili na poslužitelju. Vodič možete ponovno otvoriti iz izbornika Pomoć."],
  ] satisfies [Step, ...Step[]],
};
