/** The emoji people can add to bios, posts and chat. They are the device's own emoji: on an iPhone or Mac they are Apple's, on Android Google's, on Windows
 *  Microsoft's. (Apple's emoji artwork is Apple's and cannot be shipped inside a website, so each device draws its own.) Each entry is "emoji keywords". */
export type EmojiGroup = { id: string; label: string; icon: string; items: { e: string; k: string }[] };

const make = (id: string, label: string, icon: string, raw: string): EmojiGroup => ({
  id, label, icon,
  items: raw.split("|").map((s) => s.trim()).filter(Boolean).map((s) => { const [e, ...k] = s.split(" "); return { e, k: k.join(" ") }; }),
});

export const EMOJI_GROUPS: EmojiGroup[] = [
  make("smile", "Faces", "😀", "😀 grin happy|😃 smile happy|😄 laugh happy|😁 beam grin|😆 laughing|😅 sweat laugh nervous|🤣 rofl lol|😂 joy tears lol|🙂 slight smile|🙃 upside down|😉 wink|😊 blush smile|😇 angel halo|🥰 love hearts|😍 heart eyes love|🤩 star struck wow|😘 kiss|😗 kiss|😚 kiss|😙 kiss|😋 yum tasty|😛 tongue|😜 wink tongue|🤪 zany crazy|😝 tongue|🤑 money|🤗 hug|🤭 oops giggle|🤫 shh quiet|🤔 think hmm|🤐 zipper|🤨 eyebrow|😐 neutral|😑 expressionless|😶 silent|😏 smirk|😒 unamused|🙄 eye roll|😬 grimace|😮‍💨 sigh relief|🤥 lying|😌 relieved calm|😔 sad pensive|😪 sleepy|🤤 drool|😴 sleep tired|😷 mask sick|🤒 fever sick|🤕 hurt|🤢 nauseous|🤮 vomit|🥵 hot|🥶 cold freezing|🥴 woozy|😵 dizzy|🤯 mind blown|🤠 cowboy|🥳 party celebrate|😎 cool sunglasses|🤓 nerd study|🧐 monocle|😕 confused|😟 worried|🙁 frown|😮 wow surprised|😯 hushed|😲 astonished|😳 flushed embarrassed|🥺 pleading puppy|😦 frown|😧 anguished|😨 fear scared|😰 anxious sweat|😥 sad relieved|😢 cry sad|😭 sob crying|😱 scream shock|😖 confounded|😣 persevere|😞 disappointed|😓 downcast sweat|😩 weary|😫 tired|🥱 yawn bored|😤 triumph huff|😡 angry mad|😠 angry|🤬 swearing|😈 devil|👿 imp|💀 skull dead|☠️ skull crossbones|💩 poop|🤡 clown|👻 ghost|👽 alien|🤖 robot"),
  make("hands", "People", "👋", "👋 wave hello|🤚 raised hand|🖐️ hand|✋ stop high five|🖖 vulcan|👌 ok perfect|🤌 pinched italian|🤏 tiny small|✌️ peace victory|🤞 fingers crossed luck|🤟 love you|🤘 rock on|🤙 call me shaka|👈 left|👉 right|👆 up|👇 down|☝️ one|👍 thumbs up like yes|👎 thumbs down no|✊ fist|👊 punch|🤛 fist bump|🤜 fist bump|👏 clap applause|🙌 raised hands hooray|👐 open hands|🤲 palms|🤝 handshake deal|🙏 pray thanks please|✍️ writing|💅 nails|🤳 selfie|💪 muscle strong gym|🦵 leg|🦶 foot|👂 ear|👃 nose|🧠 brain smart|👀 eyes look|👁️ eye|👅 tongue|👄 mouth|👶 baby|🧒 child|👦 boy|👧 girl|🧑 person|👱 blond|👨 man|👩 woman|🧓 older|👴 old man|👵 old woman|🙋 raising hand question|🙇 bow|🤦 facepalm|🤷 shrug|💁 info|🙅 no|🙆 ok|🧑‍🎓 student graduate|🧑‍🏫 teacher professor|🧑‍💻 coder technologist|🧑‍🔬 scientist|🧑‍🎨 artist|🧑‍🍳 cook chef|🏃 run running|🚶 walk|💃 dance|🕺 dance|🧘 yoga calm"),
  make("hearts", "Hearts", "❤️", "❤️ red heart love|🧡 orange heart|💛 yellow heart|💚 green heart|💙 blue heart|💜 purple heart|🖤 black heart|🤍 white heart|🤎 brown heart|💔 broken heart|❣️ heart exclamation|💕 two hearts|💞 revolving hearts|💓 beating heart|💗 growing heart|💖 sparkling heart|💘 cupid arrow|💝 heart gift|💟 heart decoration|✨ sparkles shine|⭐ star|🌟 glowing star|💫 dizzy star|🔥 fire hot lit|💯 hundred perfect|💢 anger|💥 boom|💦 water drops|💤 zzz sleep|🎉 party popper tada|🎊 confetti|🏆 trophy win|🥇 gold medal first|🥈 silver|🥉 bronze"),
  make("animals", "Animals & nature", "🐶", "🐶 dog puppy|🐱 cat kitten|🐭 mouse|🐹 hamster|🐰 rabbit bunny|🦊 fox|🐻 bear|🐼 panda|🐨 koala|🐯 tiger|🦁 lion|🐮 cow|🐷 pig|🐸 frog|🐵 monkey|🙈 see no evil|🙉 hear no evil|🙊 speak no evil|🐔 chicken|🐧 penguin|🐦 bird|🐤 chick|🦆 duck|🦉 owl|🦄 unicorn|🐝 bee|🦋 butterfly|🐌 snail|🐞 ladybug|🐢 turtle|🐍 snake|🐙 octopus|🐠 fish|🐬 dolphin|🐳 whale|🦈 shark|🐘 elephant|🦒 giraffe|🐎 horse|🌵 cactus|🌲 tree pine|🌳 tree|🌴 palm|🌱 seedling plant|🍀 clover luck|🌿 herb|🌸 blossom flower|🌹 rose|🌻 sunflower|🌷 tulip|🍁 maple leaf fall autumn|🍂 leaves fall|🌞 sun|🌝 moon face|🌙 moon|🌈 rainbow|☀️ sun sunny|⛅ cloud sun|☁️ cloud|🌧️ rain|⛈️ storm|❄️ snow snowflake|⛄ snowman|🌊 wave ocean|🌍 earth world"),
  make("food", "Food & drink", "🍕", "🍏 apple|🍎 red apple|🍐 pear|🍊 orange|🍋 lemon|🍌 banana|🍉 watermelon|🍇 grapes|🍓 strawberry|🫐 blueberries|🍒 cherries|🍑 peach|🥭 mango|🍍 pineapple|🥥 coconut|🥝 kiwi|🍅 tomato|🥑 avocado|🥦 broccoli|🥕 carrot|🌽 corn|🌶️ pepper spicy|🥔 potato|🍞 bread|🥐 croissant|🥯 bagel|🧀 cheese|🥚 egg|🍳 cooking egg breakfast|🥞 pancakes|🧇 waffle|🥓 bacon|🍔 burger|🍟 fries|🍕 pizza|🌭 hot dog|🥪 sandwich|🌮 taco|🌯 burrito|🥗 salad|🍝 pasta spaghetti|🍜 ramen noodles|🍲 stew|🍛 curry|🍣 sushi|🍱 bento|🥟 dumpling|🍤 shrimp|🍚 rice|🍙 rice ball|🍦 ice cream|🍩 donut|🍪 cookie|🎂 birthday cake|🍰 cake|🧁 cupcake|🍫 chocolate|🍬 candy|🍿 popcorn|☕ coffee|🍵 tea|🧋 bubble tea boba|🥤 cup drink soda|🍺 beer|🍷 wine|🥂 cheers toast|🥛 milk|💧 water"),
  make("activity", "Activities", "⚽", "⚽ soccer football|🏀 basketball|🏈 american football|⚾ baseball|🥎 softball|🎾 tennis|🏐 volleyball|🏉 rugby|🎱 pool billiards|🏓 ping pong|🏸 badminton|🥊 boxing|🥋 martial arts|⛳ golf|🏹 archery|🎣 fishing|🛹 skateboard|🛼 roller|⛸️ ice skating|🏂 snowboard|🏄 surf|🚴 cycling bike|🏋️ weightlifting gym|🤸 gymnastics|🧗 climbing|🎮 video games gaming|🕹️ joystick|🎲 dice|♟️ chess|🧩 puzzle|🎯 target darts|🎳 bowling|🎨 art painting|🎭 theater drama|🎤 microphone sing karaoke|🎧 headphones music|🎸 guitar|🎹 piano keyboard|🥁 drums|🎷 saxophone|🎺 trumpet|🎻 violin|🎬 movie film|📸 camera photo|📚 books study|📖 reading book|✏️ pencil|📝 memo notes|🎓 graduation cap|🏫 school|🔬 science microscope|💻 laptop computer|⌨️ keyboard|🖥️ desktop|📱 phone|🎁 gift present"),
  make("travel", "Travel & places", "🚗", "🚗 car|🚕 taxi|🚌 bus|🚎 trolley|🚑 ambulance|🚒 fire truck|🚓 police|🚲 bike bicycle|🛴 scooter|🚆 train|🚇 subway metro|✈️ airplane flight|🚀 rocket|🛸 ufo|⛵ sailboat|🚢 ship|🏠 house home|🏡 house garden|🏢 office building|🏥 hospital|🏦 bank|🏪 store shop|🏛️ classical building|⛪ church|🕌 mosque|🕍 synagogue|🏟️ stadium|🗽 statue of liberty|🗼 tower|🏰 castle|🌃 night city|🌆 city sunset|🌅 sunrise|🌄 mountain sunrise|🏖️ beach|🏝️ island|🏔️ mountain|⛺ camping tent|🔥 campfire|🎡 ferris wheel|🎢 roller coaster|📍 pin location|🗺️ map|🧭 compass"),
  make("objects", "Objects", "💡", "⌚ watch|📷 camera|🔋 battery|🔌 plug|💡 idea light bulb|🔦 flashlight|🕯️ candle|💰 money bag|💵 dollar cash|💳 credit card|🧾 receipt|🛒 shopping cart groceries|🛍️ shopping bags|📦 package box|📬 mailbox|📅 calendar date|🗓️ calendar|📌 pushpin pin|📎 paperclip|🖇️ paperclips|✂️ scissors|📏 ruler|🔑 key|🔒 lock|🔓 unlock|🛏️ bed|🛋️ couch sofa|🚿 shower|🧹 broom clean|🧺 laundry basket|🧼 soap|🧽 sponge|🪴 plant pot|🎒 backpack|👕 shirt|👖 jeans|👟 sneaker|👓 glasses|🕶️ sunglasses|⏰ alarm clock|⏳ hourglass|⌛ time|📢 loudspeaker announcement|🔔 bell notification|🔕 bell off|🎵 music note|🎶 music notes|💬 speech bubble chat|💭 thought bubble|🗯️ anger bubble|📣 megaphone|✅ check done|❌ cross no|❓ question|❗ exclamation|⚠️ warning|🚫 prohibited|♻️ recycle|➕ plus|➖ minus|💲 dollar|🔗 link|🆕 new|🆒 cool|🆗 ok|🔝 top|🔜 soon|👑 crown|💎 gem diamond|🪩 disco ball"),
];

export const ALL_EMOJI = EMOJI_GROUPS.flatMap((g) => g.items);

/** Emoji whose name or keywords start with or contain what was typed. Several words must all match. */
export function searchEmoji(query: string, limit = 60) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return ALL_EMOJI.filter((x) => words.every((w) => x.k.toLowerCase().includes(w))).slice(0, limit);
}

/** Recently used emoji, newest first, kept on this device. */
const RECENT_KEY = "orbit-emoji-recent";
export function recentEmoji(): string[] {
  try { const s = localStorage.getItem(RECENT_KEY); const l = s ? (JSON.parse(s) as unknown) : []; return Array.isArray(l) ? l.filter((x): x is string => typeof x === "string").slice(0, 24) : []; } catch { return []; }
}
export function rememberEmoji(e: string) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([e, ...recentEmoji().filter((x) => x !== e)].slice(0, 24))); } catch { /* ignore */ }
}

/** Put `emoji` into `text` at the caret (or replacing the selection). Returns the new text and where the caret goes, or null if it would be over `max` characters. */
export function insertAt(text: string, emoji: string, start: number, end: number, max?: number): { text: string; caret: number } | null {
  const s = Math.max(0, Math.min(start, text.length)), e = Math.max(s, Math.min(end, text.length));
  const next = text.slice(0, s) + emoji + text.slice(e);
  if (max !== undefined && Array.from(next).length > max) return null;
  return { text: next, caret: s + emoji.length };
}
