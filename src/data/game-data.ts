// Cards Against Humanity — card database content.
export const GAME_DATA = {
  prompts: [],
  answers: [],
  packs: [],
  bots: [
    { id: "b1", name: "Priya",  color: "#7C5CFF" },
    { id: "b2", name: "Theo",   color: "#2BC4BE" },
    { id: "b3", name: "Zoe",    color: "#FF4D8D" },
    { id: "b4", name: "Marcus", color: "#5CA9FF" }
  ],
  chatLines: [
    { who: "b1", text: "yooo we're in" },
    { who: "b2", text: "I have been training for this" },
    { who: "b3", text: "someone is going DOWN tonight" },
    { who: "b4", text: "wait how do I— oh, ready" },
    { who: "b1", text: "start it start it start it" }
  ],
  reactions: ["😂", "💀", "🔥", "👏"],
  upgrades: [
    { id: "mp10", name: "Bigger Party", desc: "Host rooms with up to 10 players", price: 300 },
    { id: "mp20", name: "House Party", desc: "Host rooms with up to 20 players", price: 600 },
    { id: "swapPlus", name: "Swap Master", desc: "Swap up to 5 cards, and earn swaps every 2 rounds", price: 250 },
    { id: "customCards", name: "Custom Cards Studio", desc: "Write your own prompts and answers for any room", price: 200 },
    { id: "botOverlord", name: "Bot Overlord", desc: "Unlock unlimited bot slots to fill up your room with bots", price: 799 },
    { id: "smartBots", name: "Smart AI Bots", desc: "Gemini-powered bots that play contextually and leave funny comments in chat", price: 500 },
    { id: "botPersonalities", name: "Personality Packs", desc: "Unlock custom bot personas like Yoda, Gordon Ramsay, and Shakespeare", price: 199 }
  ],
  creditBundles: [
    { coins: 500, tag: "$4.99", productId: "prod_UiU1bLVVTs3WEp" },
    { coins: 1200, tag: "$9.99", best: true, productId: "prod_UiU1NqbXoVoF78" },
    { coins: 3000, tag: "$19.99", productId: "prod_UiU2mxisRKNBys" }
  ]
};

