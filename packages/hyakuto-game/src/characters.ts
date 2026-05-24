export type CharacterDesign = {
  displayName: string;
  textColor: string;
  borderColor: string;
  bgColor: string;
  shadow: string;
};

export const characterDesigns: Record<string, CharacterDesign> = {
  ao: {
    displayName: "Ao",
    textColor: "#6eadff",
    borderColor: "#5c90d4",
    bgColor: "rgba(18, 28, 37, 0.9)",
    shadow: "0 0 5px rgba(59,130,246,0.5)",
  },
  kou: {
    displayName: "Kō",
    textColor: "#fcb07e",
    borderColor: "#423228",
    bgColor: "rgba(18, 28, 37, 0.9)",
    shadow: "0 0 5px rgba(0,0,0,0.5)",
  },
  haruki: {
    displayName: "Haruki",
    textColor: "#cbd7dd",
    borderColor: "#5e656a",
    bgColor: "rgba(18, 28, 37, 0.9)",
    shadow: "0 0 5px rgba(0,0,0,0.5)",
  },
  tatsumi: {
    displayName: "Tatsumi",
    textColor: "#55d4c5",
    borderColor: "#22524b",
    bgColor: "rgba(18, 28, 37, 0.9)",
    shadow: "0 0 5px rgba(0,0,0,0.5)",
  },
  ren: {
    displayName: "Ren",
    textColor: "#f8e282",
    borderColor: "#4b452d",
    bgColor: "rgba(18, 28, 37, 0.9)",
    shadow: "0 0 5px rgba(0,0,0,0.5)",
  },
  mio: {
    displayName: "Mio",
    textColor: "#e2a9f1",
    borderColor: "#4a374f",
    bgColor: "rgba(18, 28, 37, 0.9)",
    shadow: "0 0 5px rgba(0,0,0,0.5)",
  },
  mc: {
    displayName: "MC",
    textColor: "#121c25",
    borderColor: "#fff2e3",
    bgColor: "rgba(206, 192, 196, 0.9)",
    shadow: "0 0 5px rgba(255,242,226,0.5)",
  },
};

export const DEFAULT_DESIGN: CharacterDesign = {
  displayName: "???",
  textColor: "#121c25",
  borderColor: "#fff2e3",
  bgColor: "rgba(206, 192, 196, 0.9)",
  shadow: "0 0 5px rgba(0,0,0,0.5)",
};

export function getCharacterDesign(character: string): CharacterDesign {
  return characterDesigns[character.toLowerCase()] ?? DEFAULT_DESIGN;
}
