/**
 * Three invented data sets for the demo and the tests. The CSV files beside this one are the source; the text is kept
 * here as strings because the host is built by Next (no `?raw` import), and samples.test.ts fails when a string and its
 * file differ. No person, no identifier, no real study: every value is made up.
 */
export type Sample = {
  /** Stable key (also the file name without ".csv"). */
  id: string;
  /** Croatian title shown on the button. */
  title: string;
  description: string;
  /** CSV text, same rules as a file chosen in the loader (separator ";", decimal comma, empty cell = no value). */
  csv: string;
};

const KOMPOSTIRANJE_CSV = `Naselje;Vrsta stanovanja;Broj osoba;Kompostira;Biootpad kg tjedno;Kompost kg tjedno;Ocjena mirisa 1-10
Selo;Kuća s vrtom;1;Da;0,8;1,4;5
Gradsko središte;Stan;2;Ne;6,3;0,0;3
Prigradsko naselje;Kuća s vrtom;3;Da;4,2;4,2;6
Selo;Stan;3;Ne;7,3;0,2;3
Gradsko središte;Kuća bez vrta;4;Ne;8,2;0,5;4
Prigradsko naselje;Stan;5;Ne;12,2;0,0;4
Selo;Stan;2;Ne;3,6;0,6;3
Selo;Kuća s vrtom;2;Da;;3,1;3
Prigradsko naselje;Kuća s vrtom;5;Ne;11,2;0,1;4
Prigradsko naselje;Kuća bez vrta;1;Ne;1,2;0,0;3
Gradsko središte;Kuća s vrtom;2;Da;0,8;1,6;5
Gradsko središte;Kuća s vrtom;1;Da;0,8;1,0;4
Selo;Kuća bez vrta;2;Ne;5,2;0,0;2
Selo;Stan;2;Ne;4,2;0,0;4
Gradsko središte;Kuća bez vrta;5;Ne;12,6;0,1;3
Prigradsko naselje;Kuća s vrtom;5;Da;8,3;5,9;5
Gradsko središte;Kuća s vrtom;5;Ne;9,2;1,0;2
Selo;Kuća s vrtom;2;Ne;3,8;0,1;2
Selo;Kuća s vrtom;2;Da;1,3;2,3;5
Prigradsko naselje;Kuća s vrtom;5;Da;8,2;5,6;
Prigradsko naselje;Stan;3;Ne;6,1;1,5;3
Selo;Kuća bez vrta;5;Ne;12,0;0,0;4
Gradsko središte;Kuća s vrtom;4;Da;5,4;4,6;5
Gradsko središte;Kuća bez vrta;5;Ne;10,6;1,1;2
Selo;Kuća s vrtom;5;Da;8,4;6,6;4
Gradsko središte;Kuća s vrtom;4;Da;5,3;5,1;6
Prigradsko naselje;Kuća s vrtom;4;Ne;6,9;0,1;4
Selo;Kuća bez vrta;3;Ne;5,3;0,0;4
Selo;Stan;4;Ne;10,2;0,0;3
Gradsko središte;Kuća bez vrta;3;Da;6,0;3,5;5
Prigradsko naselje;Kuća s vrtom;5;Ne;10,9;0,0;3
Selo;Kuća s vrtom;2;Ne;5,3;0,6;2
Selo;Kuća s vrtom;3;Da;4,7;4,8;5
Prigradsko naselje;Kuća bez vrta;4;Da;7,6;;5
Selo;Kuća s vrtom;4;Ne;10,1;0,0;2
Prigradsko naselje;Kuća bez vrta;5;Da;9,1;7,9;5
Gradsko središte;Kuća bez vrta;4;Ne;6,9;0,6;3
Selo;Kuća bez vrta;4;Ne;7,3;0,1;3
Selo;Kuća bez vrta;5;Ne;9,9;0,7;4
Selo;Kuća bez vrta;3;Ne;4,8;0,0;2
Selo;Kuća bez vrta;3;Ne;6,0;0,0;3
Selo;;2;Da;2,0;2,8;5
Selo;Stan;3;Ne;6,8;0,2;3
Gradsko središte;Kuća bez vrta;3;Da;5,0;3,2;6
Prigradsko naselje;Stan;4;Ne;8,3;0,0;2
Gradsko središte;Stan;2;Ne;4,4;0,0;1
Gradsko središte;Kuća s vrtom;4;Ne;8,3;0,0;5
Gradsko središte;Kuća s vrtom;2;Ne;4,5;0,5;2
Selo;Stan;2;Ne;3,4;0,6;3
Prigradsko naselje;Kuća bez vrta;1;Ne;3,0;1,2;4
Selo;Stan;5;Ne;11,1;0,1;4
Gradsko središte;Kuća s vrtom;1;Ne;1,2;0,0;2
`;

const ANKETA_MOBILNOST_CSV = `Dobna skupina;Glavni prijevoz;Udaljenost km;Trajanje puta min;Zadovoljstvo 1-5;Dana u tjednu bez automobila
do 25 godina;Pješice;2,3;32;4;1
do 25 godina;Automobil;15,3;39;3;2
46 i više godina;Pješice;2,5;39;4;1
46 i više godina;Javni prijevoz;8,7;48;3;3
46 i više godina;Bicikl;;21;4;5
46 i više godina;Bicikl;1,7;13;5;4
46 i više godina;Automobil;10,1;30;3;1
46 i više godina;Pješice;2,8;39;2;1
46 i više godina;Bicikl;4,0;20;3;5
46 i više godina;Bicikl;0,4;8;2;0
do 25 godina;Bicikl;1,7;14;4;5
26 do 45 godina;Bicikl;2,4;20;2;2
46 i više godina;Pješice;0,4;11;3;3
26 do 45 godina;Bicikl;4,0;22;4;0
do 25 godina;Javni prijevoz;8,3;37;5;1
do 25 godina;Bicikl;6,2;38;3;1
do 25 godina;Bicikl;2,7;17;3;0
do 25 godina;Bicikl;1,8;11;4;2
46 i više godina;Automobil;12,6;39;3;0
do 25 godina;Bicikl;1,4;13;4;4
do 25 godina;Bicikl;4,7;25;4;5
46 i više godina;Automobil;16,2;46;2;0
46 i više godina;Pješice;2,5;;4;3
do 25 godina;Bicikl;3,8;28;4;5
46 i više godina;Pješice;3,2;41;4;3
26 do 45 godina;Javni prijevoz;6,3;39;3;2
46 i više godina;Pješice;0,8;12;5;1
do 25 godina;Pješice;0,4;11;3;2
do 25 godina;Javni prijevoz;10,4;49;5;2
26 do 45 godina;Javni prijevoz;10,7;54;4;3
do 25 godina;Bicikl;2,4;22;;2
46 i više godina;Javni prijevoz;6,1;35;4;1
do 25 godina;Pješice;1,9;23;2;5
do 25 godina;Pješice;0,4;10;4;2
46 i više godina;Pješice;0,5;7;4;1
46 i više godina;Pješice;1,9;28;4;5
do 25 godina;Bicikl;2,6;13;5;3
46 i više godina;Javni prijevoz;6,6;36;4;4
26 do 45 godina;Javni prijevoz;9,2;49;4;2
do 25 godina;Pješice;1,4;24;4;5
do 25 godina;Javni prijevoz;8,9;46;3;3
26 do 45 godina;Automobil;16,7;46;4;0
do 25 godina;Bicikl;6,5;36;3;4
46 i više godina;Automobil;15,7;46;2;2
;Bicikl;6,8;43;4;2
46 i više godina;Bicikl;3,4;24;5;0
46 i više godina;Javni prijevoz;7,4;31;4;3
26 do 45 godina;Bicikl;2,4;21;4;5
`;

const MJERENJA_CSV = `Vrsta tla;Sorta;Zalijevanje ml tjedno;Visina biljke cm;Broj listova;Temperatura tla C;Odstupanje od prosjeka C
Glinasto;Žuta ruža;103;29,4;15;16,18;-0,5
Glinasto;Žuta ruža;57;24,2;14;15,45;-1,5
Glinasto;Žuta ruža;115;33,2;21;18,30;-0,1
Glinasto;Žuta ruža;124;;24;16,33;-3,4
Glinasto;Čuvarkuća;76;28,7;17;15,75;1,2
Glinasto;Žuta ruža;46;23,3;14;15,56;-0,5
Pjeskovito;Žuta ruža;73;28,3;16;16,00;-5,0
Pjeskovito;Čuvarkuća;99;30,1;15;16,23;-4,8
Glinasto;Žuta ruža;100;34,2;16;17,48;-1,0
Glinasto;Žuta ruža;69;23,7;13;17,00;-2,9
Glinasto;Žuta ruža;69;24,8;11;15,91;-7,0
Ilovasto;Žuta ruža;41;28,0;12;15,49;-0,3
Glinasto;Čuvarkuća;77;25,4;15;15,03;-3,1
Glinasto;Čuvarkuća;84;29,1;15;14,00;-3,3
Glinasto;Šljiva;86;31,4;15;16,22;-4,2
Ilovasto;Žuta ruža;49;28,1;14;17,63;-0,3
Glinasto;Čuvarkuća;121;37,1;16;16,01;-2,0
Pjeskovito;Šljiva;75;27,7;16;;2,5
Pjeskovito;Šljiva;146;42,2;26;17,61;-2,3
Ilovasto;Žuta ruža;154;49,5;27;16,65;-2,3
Pjeskovito;Žuta ruža;125;30,2;17;13,66;-0,2
Ilovasto;Čuvarkuća;148;38,8;23;18,23;-2,0
Ilovasto;Šljiva;103;38,4;21;14,80;-3,2
Pjeskovito;Šljiva;138;36,3;20;17,13;-1,7
Pjeskovito;Šljiva;159;43,3;23;15,93;-0,4
Ilovasto;Šljiva;129;41,4;23;16,54;-2,9
Pjeskovito;Čuvarkuća;;29,9;17;13,81;-1,2
Glinasto;Žuta ruža;156;40,2;24;13,51;-2,2
Ilovasto;Čuvarkuća;151;48,0;24;13,20;-0,7
Pjeskovito;Žuta ruža;128;34,8;20;12,99;-4,1
Ilovasto;Žuta ruža;157;41,2;20;19,13;0,3
Pjeskovito;Šljiva;101;28,6;13;16,42;-0,7
Glinasto;Žuta ruža;106;39,9;20;15,59;-0,0
Pjeskovito;Žuta ruža;109;33,4;15;17,32;0,2
Ilovasto;Žuta ruža;134;44,1;23;15,97;-1,9
Pjeskovito;Čuvarkuća;150;35,2;19;13,51;-1,3
Glinasto;Čuvarkuća;87;28,3;18;14,88;3,1
Pjeskovito;Čuvarkuća;104;27,9;16;15,60;-0,0
Glinasto;Žuta ruža;62;23,9;16;15,45;-1,8
Ilovasto;Žuta ruža;129;42,3;23;14,46;-0,8
Glinasto;Žuta ruža;63;23,6;11;16,46;-1,2
Pjeskovito;Šljiva;139;38,2;20;15,90;0,8
Pjeskovito;Čuvarkuća;96;23,8;15;14,31;1,9
Glinasto;Čuvarkuća;60;23,8;14;17,81;1,9
Glinasto;Šljiva;116;35,6;20;17,46;-2,2
Pjeskovito;Čuvarkuća;119;29,8;18;17,12;2,3
Glinasto;Čuvarkuća;136;36,4;16;15,44;-2,4
Pjeskovito;Žuta ruža;85;27,9;13;18,11;-3,8
Pjeskovito;Žuta ruža;96;26,4;14;17,19;-2,4
Glinasto;;126;38,4;20;15,74;-2,9
Glinasto;Žuta ruža;119;30,4;16;15,67;-2,2
Ilovasto;Čuvarkuća;138;41,6;22;12,62;-2,5
Glinasto;Čuvarkuća;109;29,9;16;16,95;-0,9
Glinasto;Šljiva;129;37,7;22;15,82;-2,9
Ilovasto;Čuvarkuća;107;37,7;19;14,12;-1,3
Glinasto;Šljiva;152;42,5;25;14,12;-3,3
`;

export const SAMPLES: readonly Sample[] = [
  { id: "kompostiranje", title: "Izmišljeno istraživanje: kućno kompostiranje", description: "Kućanstva, vrste stanovanja i količina biootpada. Sve vrijednosti su izmišljene.", csv: KOMPOSTIRANJE_CSV },
  { id: "anketa-mobilnost", title: "Izmišljena anketa: svakodnevna mobilnost", description: "Način i trajanje putovanja na posao ili studij. Sve vrijednosti su izmišljene.", csv: ANKETA_MOBILNOST_CSV },
  { id: "mjerenja-izmisljena", title: "Izmišljena mjerenja: uzgoj biljaka", description: "Rast biljaka u različitim tlima uz različito zalijevanje. Sve vrijednosti su izmišljene.", csv: MJERENJA_CSV },
];

/** The sample with this id, or `undefined` (an unknown id is not an error the screen has to survive). */
export function findSample(id: string): Sample | undefined {
  return SAMPLES.find((sample) => sample.id === id);
}
