/** Preset profile backgrounds, mirroring the reference board's selectable backgrounds. */
export type Background = { key: string; label: string; css: string };

export const BACKGROUNDS: Background[] = [
  { key: "", label: "Keins", css: "" },
  { key: "logo-orange", label: "Logo – Orange", css: "linear-gradient(135deg,#d23c22 0%,#ee4d2e 100%)" },
  { key: "logo-new", label: "Logo – für Neuschwuchteln", css: "linear-gradient(135deg,#1f6f8b 0%,#2b9fc4 100%)" },
  { key: "logo-mid", label: "Logo – für Mittelaltschwuchteln", css: "linear-gradient(135deg,#6b5b95 0%,#8f7bc4 100%)" },
  { key: "logo-old", label: "Logo – für Altschwuchteln", css: "linear-gradient(135deg,#3f4a3f 0%,#5c6b5c 100%)" },
  { key: "shrug-orange", label: "¯\\_(ツ)_/¯ – Orange", css: "linear-gradient(135deg,#a8431f 0%,#d26b2a 100%)" },
  { key: "shrug-new", label: "¯\\_(ツ)_/¯ – für Neuschwuchteln", css: "linear-gradient(135deg,#2a5f73 0%,#3d8ba6 100%)" },
  { key: "shrug-mid", label: "¯\\_(ツ)_/¯ – für Mittelaltschwuchteln", css: "linear-gradient(135deg,#4a3f6b 0%,#6f5c9e 100%)" },
  { key: "shrug-old", label: "¯\\_(ツ)_/¯ – für Altschwuchteln", css: "linear-gradient(135deg,#333c33 0%,#4d5a4d 100%)" },
  { key: "bongo", label: "Bongokadse", css: "linear-gradient(135deg,#7a5c00 0%,#c79a12 100%)" },
  { key: "green", label: "Grün – der Demokratie", css: "linear-gradient(135deg,#1f5c2e 0%,#2f8f45 100%)" },
];

export const backgroundOf = (key: string | null | undefined): Background =>
  BACKGROUNDS.find((b) => b.key === (key ?? "")) ?? BACKGROUNDS[0];
