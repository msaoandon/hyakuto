export type CharacterDesign = {
  displayName: string;
  textColor: string;
  borderColor: string;
  bgColor: string;
  shadow: string;
  tailUrl: string;
};

export const characterDesigns: Record<string, CharacterDesign> = {
  ao: {
    displayName: "Ao",
    textColor: "#6eadff",
    borderColor: "#5c90d4",
    bgColor: "rgba(18, 28, 37, 0.9)",
    shadow: "0 0 5px rgba(59,130,246,0.5)",
    tailUrl: '',
  },
  kou: {
    displayName: "Kō",
    textColor: "#fcb07e",
    borderColor: "#785B48",
    bgColor: "rgba(18, 28, 37, 0.9)",
    shadow: "0 0 5px rgba(0,0,0,0.5)",
    tailUrl: 'tail_01.png',
  },
  haruki: {
    displayName: "Haruki",
    textColor: "#cbd7dd",
    borderColor: "#5e656a",
    bgColor: "rgba(18, 28, 37, 0.9)",
    shadow: "0 0 5px rgba(0,0,0,0.5)",
    tailUrl: 'tail_02.png',
  },
  tatsumi: {
    displayName: "Tatsumi",
    textColor: "#55d4c5",
    borderColor: "#28665D",
    bgColor: "rgba(18, 28, 37, 0.9)",
    shadow: "0 0 5px rgba(0,0,0,0.5)",
    tailUrl: 'tail_03.png',
  },
  ren: {
    displayName: "Ren",
    textColor: "#EADA90",
    borderColor: "#655C37",
    bgColor: "rgba(18, 28, 37, 0.9)",
    shadow: "0 0 5px rgba(0,0,0,0.5)",
    tailUrl: 'tail_04.png',
  },
  suzune: {
    displayName: "Suzune",
    textColor: "#e2a9f1",
    borderColor: "#4a374f",
    bgColor: "rgba(18, 28, 37, 0.9)",
    shadow: "0 0 5px rgba(0,0,0,0.5)",
    tailUrl: 'tail_02.png',
  },
  mc: {
    displayName: "MC",
    textColor: "#121c25",
    borderColor: "#c7dbf5",
    bgColor: "rgba(165, 203, 253, 0.9)",
    shadow: "0 0 10px rgba(110, 180, 255, 0.55)",
    tailUrl: '',
  },
  // The VN prose voice. Rendered without an avatar/name/bubble — only the text
  // colour is read by VnNarration.
  narrator: {
    displayName: "",
    textColor: "#d8cfd6",
    borderColor: "transparent",
    bgColor: "transparent",
    shadow: "none",
    tailUrl: '',
  },
};

export const DEFAULT_DESIGN: CharacterDesign = {
  displayName: "???",
  textColor: "#121c25",
  borderColor: "#fff2e3",
  bgColor: "rgba(206, 192, 196, 0.9)",
  shadow: "0 0 5px rgba(0,0,0,0.5)",
  tailUrl: 'tail_01.png',
};

export function getCharacterDesign(character: string): CharacterDesign {
  return characterDesigns[character.toLowerCase()] ?? DEFAULT_DESIGN;
}
