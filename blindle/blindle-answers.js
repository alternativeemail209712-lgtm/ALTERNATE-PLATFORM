// blindle-answers.js
// The curated list of possible SECRET words for BLINDLE (and every game that shares its
// word bank: Oracle, Colorblindle, Colordle, Structle, Twistle, Textle, Crossdle), grouped
// by word length (4 through 20 letters). Every word is a real English word that an average
// adult has met in everyday life, school, work or media - no abbreviations, no proper names,
// no jargon and nothing unsuitable for a public livestream. Lazy "+s" plurals of other
// entries are skipped (FOOD, not FOODS).
//
// UPDATE 20 - MUCH LARGER POOL: the bank grew from ~4,000 to ~8,700 words. It is split in two:
//   CORE_WORDS     - the original hand-curated words plus a large batch of very familiar
//                    everyday words (animals, foods, objects, nature, jobs, feelings, verbs...)
//   EXTENDED_WORDS - additional real-but-less-everyday words (still fair: things like "cobalt",
//                    "meander", "mosaic", "hijack", "ambiguity"). The difficulty engine
//                    (blindle-difficulty.js) leans on these for MEDIUM / HARD rounds, so
//                    NORMAL rounds stay friendly while HARD / RANDOM rounds give high-dexterity
//                    players something genuinely challenging.
// ANSWER_WORDS (core + extended) keeps the exact same shape as before, so no game needed to
// change how it reads the bank.
//
// This is separate from the guess dictionary (see blindle-dictionary.js), which is enormous
// (370,000+ words) and only checks whether a viewer's comment is a real, guessable word.

const CORE_RAW = {
  4: `
able acid aged also anti arch area aria army atom aunt auto away axis baby back bail bake ball band
bank bare barn base bash bath beam bean bear beat beef beep beer bell belt bend beta bias bike bill
bind bird bite blah blob blog blow blue blur boat body bold bolt bond bone book boot boss both bowl
bulb bull bump burn bush busy byte cafe cake calf call calm came camp cape card care cart case cash
cast cave cell cent chap char chat chef chin chip chop cite city clam clay clip club clue coal coat
code coin cold colt comb come cone cook cool copy cord core corn cost cozy crab crew crop crow cube
curl cute cyan dare dark dart dash data date dawn dead deal dear debt deck deep deer demo deny desk
dial dice diet dime dine dirt disc dish disk dist dive dock dome done door dose dove down drag draw
drip drop drum dual duck dumb dump dune dusk dust duty each earn ease east easy echo edge edit else
emit envy epic euro even ever exam exit face fact fade fail fair fake fall fame farm fast fate fawn
feed feel fern file fill film find fine fire firm fish five flag flap flat flea flex flip flow foal
foam fold folk fond font food fool foot ford fork form fort four free frog fuel full fund fuse gain
gale game gate gave gear gene gift girl gist give glad glob glow glue goal goat gold gone gong good
gown grab gram gray grid grin grip grow gulf gulp gust hack hail hair half hall halt hand hang hard
harm harp hash haul hawk head heal heap hear heat heel held help herb hero hide high hike hill hint
hire hold hole holy home hood hook hope horn host hour huge hull hunt hurt icon idea idle inch info
init iota iris iron isle item jade jail java jazz jean jeep join joke jolt judo jump jury just keen
keep kept kick kill kind king kiss kite kiwi knee knot know lace lack lady lake lamb lamp land lane
lark last late lava lawn lazy lead leaf leak leap left lend lens less life lift like lily lime line
link lint lion list lite live load loaf loan lock loft logo long look loop lord lose loss lost loud
love luck lump lung lush lynx made maid mail main make male mall mane many mark mask mass mast mate
math maze meal mean meat meet melt memo menu mesh mess meta meth mike mild mile milk mime mind mine
mini mint minx misc miss mist moat mock mode mole monk mono mood moon more moss most moth move much
mule must nail name navy near neat neck nest news next nice nine node none noon norm nose note null
oath oboe okay omen omit once only onto open oval oven over pace pack page pail pain pair pale palm
para park part pass past path pawn peak pear peek peel peer perm pest pick pier pile pill pine pink
pipe plan play plot plug plum plus poem poet pole poll polo pond pony pool poor pork port pose post
pour pray prep prey prim prod prop pull puma pump pure push quad quit quiz race rack raft rage rail
rain ramp rank rare rash rate read real rect redo reed reef rely rent rest rice rich ride ring rink
riot rise risk road roar robe rock role roll roof rook room root rope rose ruby rude rule rush rust
sack safe sage said sail sake salt same sand sane sans save scan scar seal seam seat sect seed seek
seem seen self sell semi send sent shed shin ship shoe shop show shut sick side sift sign silk sine
sing sinh sink site size skew skin skip slam slap sled slim slip slot slow slug snap snow soap soar
sock soft soil sold sole some song soon sore sort soul soup sour spam span spec spin spot spur stab
star stay stem step stew stir stop stub such suit sure surf swan swap sway swim sync taco tail take
tale talk tall tank tape task taxi teal team tear tech tell temp tend tent term test text thaw then
thin thru tick tide tidy tiff tile till time tiny tire toad toil told toll tomb tone took tool tort
tour town trap tray tree trim trip trot true tuba tube tuck tuna tune turn twin type typo ugly undo
unit upon urge used user vain vary vase vast veil verb very vest vice view vine visa void vote wade
wage wait wake walk wall want warm warn wash wasp wave wavy weak wear weed week well west wide wife
wiki wild will wind wine wing wink wipe wire wise wish wolf wood wool word work worm wrap yang yard
yarn yawn year yell yoga zero zone zoom
`,
  5: `
abbey abide abort about above actor acute adapt adopt adult again agent agree ahead alarm album
aleph alert alias alien align alive alley allow alone along alpha alter amber amend among angel
anger angle ankle apart apple apply apron arena arise aroma array arrow aside asset atlas attic
audio audit avail avoid await award aware azure badge badly bagel baker banjo barge baron basic
basil basis batch beach beard beast begin beige below bench berry bevel bingo birch black blade
blame blank blast blaze blend blink block bloom blush board boast bogus bonus boost booth bound
brace brain brake brand brave bread break breve brick bride brief bring brisk brook broom brown
brush brute buddy buggy build built bumpy bunch bunny burst cabin cable cache camel canal candy
canoe caret carol carry catch cause cedar cello chain chair chalk chaos charm chart chase cheap
check cheek cheer chess chest chick chief child chill chime chose chunk cider cigar civic claim
clamp clash class clean clear clerk click cliff climb cloak clock clone close cloth cloud clown
coach coast cobra cocoa colon color combo comet comic comma coral couch cough could count court
cover crack craft crane crash crawl crazy cream creek crisp cross crowd crown cruel crush cubic
curly curry curve cycle daily daisy dance datum dealt debug delay delta dense depth diary digit
diner dirty ditto dizzy dodge donor doubt dough dozen draft drain drama drawn dream dress drift
drill drink drive dummy dusty dutch eager eagle early earth easel eight eject elbow elder elite
email embed emoji empty enjoy enter entry epoch equal erase error event every exact excel exist
extra fable fairy faith false fancy fatal fault favor feast fence ferry fetch fever fiber field
fifth fifty fight final first fjord flair flame flash fleet flesh float flock flood floor flour
fluid flush flute focus foggy force forge forth forty forum found frame frank fresh front frost
frown fruit fudge fully funny fuzzy gamma gauge ghost giant given glass glide globe gloom glory
glove glyph goose grace grade grain grand grant grape graph grass grave gravy great green greet
grill groom group grove guard guess guest guide gully habit handy happy harsh haste hasty hatch
haunt haven heart heavy hedge hello hence hiker hippo hobby holly honey honor horse hotel house
hover human humid humor hurry hyena icing ideal igloo image imply inbox index inert infer infix
inner input inset intro irony issue itchy ivory jelly jewel joint joker jolly judge juice juicy
kappa karma kayak kebab kneel knife knock known koala label lance large laser latch later latex
laugh layer learn lease least leave legal lemma lemon lemur level lever light lilac limit linen
liner llama lobby local lodge logic loose lotus lover lower loyal lucky lumpy lunar lunch lurch
macro madam magic major mango maple march marsh mason match maybe mayor meant medal media melon
mercy merge merit messy metal meter micro might mimic miner minor minus miter mixer mocha modal
model moist money month moose moral motor motto mount mouse mouth movie muddy multi music naive
nanny nasty naval nerve never newly niche night ninja noble noise noisy nomad north novel nurse
nutty oasis occur ocean octet offer often olive omega onion opera opine orbit order other otter
outer owner ozone paint panda panel panic pants paper parse party pasta paste patch pause peace
peach pearl pedal penny perch phase phone photo piano piece pilot pinch pitch pivot pixel pizza
place plain plane plant plate plaza plead pluck plush poach point poker polar polka poppy porch
pouch pound power press price pride prime print prior prize proof proud prove proxy prune pulse
punch pupil puppy purse quack quake quark quart quasi queen query queue quick quiet quilt quite
quote radar radio radix raise rally ranch range rapid ratio ravel raven razor reach react ready
realm rebel refer reign relax relay renew reply reset retry reuse rider ridge rifle right rigid
rinse risky rival river robin robot rocky rogue rough round route royal rugby ruler rumor rural
rusty sadly saint salad salon sandy sauce sauna scale scarf scary scene scent scoop scope score
scout screw scrub sense serif serve seven shade shaft shake shaky shall shape share shark sharp
sheep sheet shelf shell shift shine shiny shirt shock shore short shout shown shrub siege sight
sigma silky silly since sixth skate skill skirt skull slant slash slate sleek sleep slept slice
slide slope small smart smash smell smile smith smoke snack snail snake sneak snore soggy solar
solid solve sorry sound south space spare spark spawn speak speed spell spend spent spice spicy
spike spine split spoon sport spray squad stack staff stage stain stair stake stale stamp stand
stare start state steak steam steel steep steer stick stiff still sting stock stone stood stool
store storm story stove straw strip strut stuck study stuff style sugar suite sunny super surge
sushi swamp swarm swear sweat sweep sweet swift swing sword table taken taste teach teddy teeth
tempo tempt tenor tense tenth thank theme theta thick thief thing think third thorn three throw
thumb tidal tiger tight tilde timer timid tired title toast today token tonic tooth topaz topic
torch total touch tough towel tower toxic trace track trade trail train trait tramp trans trash
treat trend trial tribe trick tried troop trout truck truly trunk trust truth tulip tunic turbo
tutor twice twirl twist ultra uncle under unify union unite unity until upper upset urban usage
usual utter valid value valve vapor vault venue versa verse video vigor villa vinyl viola viral
virus visit vital vivid vocal voice voter wafer wagon waist waltz waste watch water weary weave
wedge weigh weird whale wheat wheel where while whirl white whole whose widow width wield windy
witch witty woman world worry worse worst worth would wound wrist write wrong wrote yacht yield
young youth zebra zesty
`,
  6: `
abroad absent absorb accent accept access accuse across acting action active actual adjust admire
advice advise affair affect afford agency agenda almond almost alpaca always amount anchor animal
annual answer anyone anyway appeal appear append arctic around arrive artist ascent aspect assert
assign assist assume atomic attach attack attend august author autumn avenue backup badger bakery
ballet banana banner barber barrel barren basket battle beacon beauty became become before behalf
behave behind belief belong berlin beside better beware beyond binary bishop bitter blouse bobcat
border boring borrow botany bottle bottom bounce boxing branch breeze breezy bridge bright broken
bronze bubble bucket buckle budget buffet bullet bundle burden bureau butler button bypass cactus
camera campus canary cancel candle canvas canyon carbon career carpet carrot cashew casino castle
casual cattle caught cavern celery center cereal chance change chapel charge cheese cherry chilly
choice choose chorus chosen chrome cinema cipher circle circus clause clever client clinic closet
clover clumsy coerce coffee column comedy commit common comply condor convex cookie copper corner
cosine costly cotton cougar county couple course cousin cowboy coyote cradle crater crayon create
credit crispy cruise cursor custom cyclic dainty dancer danger dealer debate decade decent decide
decode deeper deeply defend define degree delete demand denied denote dental depend derive desert
design desire detach detail detect device dialog dinner direct divide diving doctor dollar domain
domino donkey doodle double dragon drawer dreamy driver duplex during easily editor effect effort
either elated eleven emblem emerge empire employ enable encode ending energy engage engine enough
ensure entire entity eraser escape estate evenly evolve exceed except excess excuse exotic expand
expect expert export expose extend extent fabric factor fairly falcon fallen family famous farmer
fasten father faucet fellow female ferret fiddle fierce figure filter finger finish finite fiscal
flavor flight flower fluffy flying follow forbid forest forget formal format former fossil fourth
freely freeze french fridge friend frosty frozen fruity funnel fusion future gadget galaxy gallon
gallop gamble garage garden garlic gather gentle german geyser giggle ginger glance global gloomy
glossy gobble goblet golden gopher gospel gossip govern grease greedy groove ground growth grumpy
guilty guitar hammer handle hanger happen harbor hardly hazard health heater height helium helmet
hermit hidden highly hockey hollow honest hornet humble hungry hunter hybrid hyphen icicle ignore
iguana impact import impose indeed indigo indoor infant inform inject injury inline insect insert
inside intact intend intent intern invent invert invite invoke island italic itself jackal jacket
jagged jaguar jersey jigsaw joyful juggle jungle junior karate kennel kernel kettle kitten knight
ladder lagoon lately launch laurel lawyer layout lazily leader league legacy legend length lesson
letter liable likely linear listen little lively lizard locale locate locker lonely lookup lovely
lumber luxury magnet magpie mainly mammal manage manner manual marble margin marine marker market
maroon martin master matrix matter meadow median medium mellow member memoir memory mental merely
meteor method metric middle minute mirror mobile modern modest modify module modulo moment monkey
mostly mother motion muffin mumble murmur muscle museum mutate mutual myself narrow nation native
nature nearby nearly needle negate nephew newton nibble nicely nickel nobody noodle normal notice
notify notion number nutmeg object obtain ocelot office offset omelet online opaque opener oppose
option orange orchid orient origin outfit outlet output oxygen packet paddle palace papaya parade
parcel parent parity parrot pascal patent patrol peanut pebble pencil people pepper period permit
person phrase pickle picnic pigeon pillow planet player please pledge plural pocket poetry police
policy polish polite poorly portal possum potato pounce powder prefer prefix preset pretty prince
prison profit prompt proper public puffin puppet purely purple puzzle python quartz quiver rabbit
racing radial radish radius raisin random rarely rather rattle reader really reason recall recent
recipe record reduce refine reform refuse regard region reject relate relief reload remain remark
remedy remind remote remove rename repair repeat report rescue resize resort result resume retain
retire return reveal revert review reward rewind rhythm ribbon riddle ripple robust rocket rotate
rowing rubber ruling runner saddle safari safely safety sailor salami salmon sample sandal sanity
scalar scarce schema scheme school scream screen script scroll search season second secret sector
secure select sender senior serene serial series server sesame settle shadow shield shiver shovel
shower shrink signal silent silver simple simply singer single sister sketch skiing sleepy slight
slogan sloppy smooth snappy sneeze soccer social socket soften solely solemn sorbet source sparse
sphere sphinx spider spirit splash splice spline sponge spread spring sprint square squash stable
static statue status steady stereo sticky stitch stormy stream street stress strict stride strike
string stripe stroke strong studio sturdy submit subset subtle subway sudden suffer suffix summer
sundae sunset supper supply surely survey switch symbol syntax system tablet tackle tailor talent
target tattoo teapot temple tender tennis tensor theory thesis thirty though thread thrill throat
thrown ticket tickle timber tiptoe tissue toggle tomato tongue toucan toward travel treaty tribal
tricky triple trophy tumble tundra tunnel turkey turnip turtle twelve twenty unable unique unless
unlike unlink unpack unsafe unwrap update upload upside urgent usable useful vacuum valley vanish
vector velvet vendor verbal verify versus vertex vessel victim violet violin vision visual volume
voyage waddle waffle waiter wallet walnut walrus wander warden warmth wealth weapon weasel weekly
weight widely widget wiggle willow window winter wisdom within wizard wobbly wonder wooden worker
worthy wright writer yellow yogurt zenith zipper zodiac
`,
  7: `
abandon ability absence academy account achieve acquire acrobat acronym address advance against
airline airport alcohol algebra already amazing ambient analyze anatomy ancient android angular
animate another antenna anxiety anxious anymore applaud apricot archery archive arrange arrival
article artisan athlete attempt attract auction augment average avocado awesome awkward bagpipe
balance balloon bandage banquet bargain barrier bashful bassoon bathtub battery bearing because
bedroom believe benefit between bicycle biology biscuit blanket blender blossom bluntly bonfire
boulder bowling bracket bravery breathe brittle brother brownie buffalo burrito butcher cabbage
cabinet caboose capable capital captain caption capture caramel caravan careful caribou catalog
caution ceiling central century certain chamber channel chapter charity charter cheddar cheetah
cherish chicken chimney chronic circuit citizen classic cleanup clearly climate closely closure
cluster coconut collage collect college combine command comment compact company compare compass
compile complex compose compute concept concert concise conduct confirm conform connect consent
consist console consult consume contact contain content contest context contour control convert
correct corrupt costume cottage council counter country courage courier creator cricket crimson
crooked crowded crystal culture cupcake curious current curtain cushion custard cutting cycling
dancing decimal declare decline default defense deflate delight deliver density dentist deposit
descent deserve desktop despite dessert destiny destroy develop diagram diamond digital dignity
dilemma diploma disable discard discuss dismiss display dispose divisor dolphin drawing dresser
drizzle dungeon dynamic eastern eclipse ecology economy edition elegant element ellipse embrace
emerald emotion emperor emulate enclose encrypt endless endorse enforce english enhance entropy
environ episode epsilon equally essence evening exactly examine example excited exclude execute
exhaust exhibit expense explain explore express extract extreme factory failure fantasy fashion
feather feature fencing fiction fighter finally finance fishing fitness fixture flatten florist
flutter foreign forever forgive formula fortune forward fragile freedom freight fuchsia fulfill
furious furnace further gallery garbage garment gazelle general generic geology gesture giraffe
glacier glimpse glitter gondola gorilla grammar granite granola graphic gravity grocery grossly
growing habitat halfway hallway hammock hamster handful harmony harvest healthy hearing heavily
helpful herself hexagon history holiday hopeful hostile however hundred hunting husband iceberg
ideally illegal illness imagine implied impress improve include inexact inflate inherit initial
inquire insight inspect inspire install instant instead integer intense invalid inverse involve
isolate iterate jackpot janitor jasmine jealous jeweler jewelry journal journey juggler justice
justify keyword kingdom kitchen knowing knuckle lantern lasagna lasting latency laundry lawsuit
lecture leopard lettuce lexical liberty library license lighter limited literal lobster locally
locator logical loosely lottery machine magenta magical mailbox mammoth manatee mansion maracas
marshal massive maximal maximum meaning measure medical meerkat meeting mention mermaid message
migrate mineral minimal minimum minivan miracle mission mistake mixture modular modulus monitor
monsoon monster monthly morning musical mustard mutable mystery narwhal natural nearest neither
nervous network neutral notable notably nothing nuclear numeral numeric nursery oatmeal oblique
observe obvious octopus officer offline opacity opening operand operate opinion optical optimal
orchard ordinal organic ostrich outcome outdoor outline outlook outside overall overlap overlay
package padlock painter palette pancake panther parking parsley partial partner passage passion
passive pasture patient pattern payment peacock peasant pelican penalty penguin pension percent
perfect perform perfume perhaps permute persist pertain petunia phantom phoenix physics picture
pioneer piranha pitcher plainly planner plastic plateau playful plumber plunger polygon popcorn
popular portion possess postage poverty prairie precede precise predict premium prepare present
pretend pretzel prevent preview primary printer privacy private problem proceed process produce
product profile program project promise promote protect protein provide publish pudding pumpkin
purpose pursuit puzzled pyramid quality quantum quarrel quarter quartet quickly raccoon radical
rainbow ravioli reached reading reality realize rebuild receipt receive recover recycle redwood
reflect refresh regular related release relieve removal replace reptile request require rescale
reserve reshape resolve respect respond restart restore retreat revenue reverse rewrite rhubarb
rooster roughly routine royalty running sadness sailing sandbox satisfy sausage savanna scamper
scarlet scholar science scooter scratch seagull section seeking segment selfish senator serious
service session setting seventh several shallow shampoo sharing shelter sheriff shining shorten
shorter shuffle shuttle sibling sidebar silence similar simplex singing sixteen skating slender
slither smaller smiling sneaker snippet society soldier solving somehow someone sparrow spatial
speaker special specify spinach sponsor squeeze stadium stagger stapler startup stately station
staying steamer sticker stomach storage strange stretch student stumble subject succeed success
suggest summary sunrise support suppose supreme surface surfing surgeon surplus survive suspect
suspend sustain swallow sweater swimmer symptom tabular tadpole tangent teacher tension termite
terrace textual texture theater theorem therapy thereby thereof thicken thimble thirsty thistle
thought through thunder toaster topping tornado totally tourist tractor trading traffic tragedy
trailer trainer transit trapeze treason tremble trivial trolley trouble truffle trumpet tsunami
tugboat typhoon typical ukulele unbound unequal unicorn uniform unknown unusual upgrade upright
useless usually utility vacancy vaccine vampire vanilla variant variety various vehicle venture
verbose verdict version veteran vibrant victory village vintage violent virtual visible visitor
vitamin volcano voucher vulture walking warning warthog washing wealthy weather website wedding
weekday weekend welcome western whereas whisper whistle wildcat willing winning wishing without
witness working worried writing written zoology
`,
  8: `
aardvark absolute abstract academic accident accuracy accurate activate activity actually adaptive
addition additive adequate adjacent airplane allocate alphabet although aluminum ambition analysis
ancestor annotate announce antelope anything anywhere apparent appendix appetite applause approach
approval aquarium argument armchair artifact artistic assemble assorted asterisk athletic attitude
audience backbone backdrop backpack backward backyard bacteria baseball baseline bathroom behavior
birthday blissful blizzard bookcase bookmark boundary bracelet broccoli building bulletin burgundy
business calculus calendar campaign capacity cardinal careless carnival carriage category cautious
ceremony champion checkbox checkout checksum cheerful chemical chestnut children chipmunk chromium
cinnamon circular citation civilian clarinet classify clearing climbing closeout clothing collapse
colorful combined comedian commerce commonly complain complete compound compress computer conclude
concrete conflict confused congress consider constant continue contract contrast converge convince
coverage creation creative creature criminal critical crossing cucumber currency customer database
daughter dazzling decision decorate decrease dedicate defender definite delegate deletion delicate
delivery describe designer detailed detector diagonal dialogue diameter directly disaster discount
discover discrete disjoint dispatch disposal distance distinct district dividend division document
dominant doorbell doughnut download dramatic dressing driveway dumpling duration dynamite eggplant
election electron elegance elephant elevator ellipsis elliptic emission emphasis employee employer
endeavor endpoint engineer enormous ensemble entirely entrance envelope equality equation eruption
escalate espresso estimate evaluate eventual everyday everyone evidence exchange exciting exercise
existing expected explicit explorer exponent exposure extended external fabulous facility fallback
familiar farewell farmland favorite fearless feasible feedback festival fighting figurine finalist
finalize firewood firework fishbowl flagship flamingo flexible floating flooding football foothill
footnote footstep forecast forklift formulae fortress fraction fragment frequent friendly frontier
frosting function gardener gasoline generate generous geometry geranium gigantic globally glorious
glossary goodwill gorgeous graceful gradient graduate grateful greeting guidance handbook handsome
hardware harmless harmonic hazelnut headache headless headline heavenly hedgehog hesitate highland
homepage homework honestly hospital hydrogen identify identity illusion implicit inactive incident
increase indicate indirect industry infinite infinity informal initiate innocent insecure instance
integral interact interest interior internal internet interval invasion isolated judgment junction
kangaroo keyboard kindness knapsack lacrosse landlord landmark language latitude laughter lavender
leftover lemonade lifetime ligature lighting likewise listener literary localize location logistic
lollipop lonesome macaroni magazine magician magnetic maintain majority manifest manually marathon
marginal marigold material maternal mattress maximize meantime meatball mechanic medicine membrane
memorial merchant midnight military minimize minister minority mismatch mistaken moderate modified
modifier molecule momentum mongoose moonbeam moreover mosquito mountain movement multiple multiply
mushroom musician mutation mutually mystical narrator national navigate necklace negation negative
neighbor nickname nitrogen nonsense normally northern notation notebook novelist nutrient obsolete
obstacle occasion offering official operator opposite optimize optional ordinary organize original
ornament outlined overcome overflow overhead overload overlook override overview painting paradise
parallel particle passport password patience pavement peaceful pedestal periodic personal persuade
pharmacy physical pinwheel pipeline plankton planting platform platypus pleasant pleasure plumbing
polished populate portable portrait position positive possible possibly postcard powerful practice
preamble precious presence preserve pressure previous princess printing priority prisoner probably
progress promised properly property proposal prospect protocol provider province publicly purchase
quadrant quantity question quotient radiator randomly rational reaction readable receiver recently
reckless recorder recovery recreate redirect referral regional register registry relation relative
relaxing relevant reliable reliably religion remember reminder repeated reporter republic required
research reserved resident residual resource response restless restrict restroom retailer retrieve
reusable revision richness rickshaw ringtone riverbed romantic roommate rotation sailboat sandwich
sanitize sapphire scalable scenario schedule scissors scorpion scribble sculptor seahorse seashell
seashore seatbelt security selected selector selfless semantic semester sensible sentence sentinel
separate sequence severity shipment shopping shortcut shoulder showcase shutdown sidekick sidewalk
silently simplify simulate singular skeleton skillful slightly slippery smoothie snapshot snowfall
software solution somewhat southern souvenir specific specimen spectral spectrum spelling spinning
splendid spotless spurious squirrel standard standing starfish starting steadily sticking stimulus
stingray stirring stoppage straight strategy strength stressed strictly striking strongly struggle
stubborn stunning subtitle subtract suitable suitcase sunlight sunshine suppress surprise surround
survival suspense sweeping swimming symbolic symmetry sympathy symphony tabletop tactical tailored
tailwind tangible tapestry teaching teammate teaspoon teenager telegram template terminal terrible
terrific textbook thankful thematic thorough thousand throttle throwing timeless timeline together
tolerant tolerate tomorrow tortilla tortoise tracking training transfer traveler traverse treasure
triangle tricycle trombone tropical truncate truthful tutorial tweezers ultimate umbrella unbroken
uncommon underway unicycle uniquely universe unlikely unstable unwanted upstream vacation validate
validity valuable variable variance velocity verbatim verified vertical vineyard violence visually
volatile wardrobe warranty wasteful watchdog watchful weighted whatever whenever wherever wildfire
wildlife windmill wireless wishbone woodland workbook workflow workshop wrapping yourself zeppelin
zucchini
`,
  9: `
abundance accepting accessory accompany accordion adjective admission advantage adventure adversary
advertise aesthetic affiliate afternoon afterward aggregate agreement algorithm alignment alleviate
alligator allowance alongside alternate ambiguity ambiguous ambulance amendment amplifier amplitude
ancestral animation announcer anonymous apartment apologize apparatus appetizer appliance arbitrary
archetype architect arrowhead artichoke ascension asparagus assertion assistant associate assurance
astronaut astronomy attendant attention attribute aubergine authentic authority authorize automatic
auxiliary available avalanche avoidance awareness backspace backstage backtrack badminton bandwidth
basically beautiful beginning benchmark bilateral bilingual billboard biography blackbird blacklist
blueberry blueprint bookshelf bookstore boomerang bootstrap boulevard boundless breakable breakdown
breakfast briefcase brilliant broadcast bubblegum bulldozer butterfly cafeteria calculate calibrate
candidate carefully carnation carpenter cartwheel cathedral celebrate celebrity certainly certainty
certified challenge chameleon champagne character checkmate chemistry chocolate cityscape classical
classroom clearance clipboard clockwise closeness cognitive coherence collector collision colorless
commander committee commodity community companion competent complaint compliant component composite
condition conductor confident confusion connected consensus consonant construct container continent
continuum cooperate copyright corporate correctly countable courtyard cranberry criterion crocodile
croissant crosshair crossover crossword curiosity currently curvature customary customize dalmatian
dandelion dangerous dashboard debatable deciduous decompose decorated deduction defective defendant
defensive deference deficient deflation delicious democracy departure dependent depletion deprecate
described designate desirable detection detective determine detriment deviation diagnosis different
difficult diffusion dimension direction directive directory disappear discharge discourse discovery
dismantle dismissal disparity disregard divergent diversion diversity divisible downgrade downright
dragonfly duplicate ecosystem editorial education effective efficient elaborate elegantly elemental
elevation eliminate emergency emphasize empirical emptiness enclosure encompass encounter encourage
endlessly enjoyment enumerate ephemeral equipment equitable eradicate erroneous essential establish
etiquette evergreen everybody evolution exactness excellent exception excessive exclusion exclusive
excursion execution executive exemplary exhausted existence expansion expensive expertise explained
explosion explosive extension extensive extremely extremity fairytale fantastic farmhouse fictional
financial firebrick fireplace flashback flashcard flatbread flowchart following footprint forbidden
forgotten formation formulate fortunate framework freelance frequency freshness furniture gardening
generally generator gentleman genuinely geography geometric gibberish gradually graduated graphical
gratitude guacamole guarantee guideline gymnasium gyroscope hairbrush handshake happiness harmonica
hazardous headphone headscarf heartbeat hereafter heuristic hexagonal hibernate hierarchy highlight
hilarious histogram hopefully hourglass household hurricane hydration hyperlink hypertext hyphenate
identical idiomatic ignorance imaginary imbalance immediate immutable imperfect implement important
inability incidence inclusion inclusive incognito incorrect increment incumbent indicator induction
influence ingenious initially injection innermost insertion inspector instantly institute insurance
integrate integrity intensity intensive intention intercept interface interfere interlace interpret
interrupt intersect interview intricate intrinsic introduce intuition intuitive invariant invention
inventory inversion invisible irregular isolation isosceles iteration jackknife jellyfish justified
keystroke kilometer knowingly knowledge landscape launchpad lawnmower liability libertine librarian
lifeguard lifestyle lightness lightning lightyear limestone limousine linearity literally logarithm
longitude lookalike lowercase luminance lunchtime machinery magically magnesium magnitude mainframe
malicious malignant mandatory marketing marmalade marvelous masculine massively meanwhile mechanism
medically megaphone memorable mentioned mercurial messenger microchip microwave migration milestone
milkshake milligram minuscule moderator molecular monastery monograph multitude nanometer narrative
nastiness naturally navigable navigator necessary necessity negligent negotiate newspaper nightmare
noiseless nonlinear normality normalize northeast northwest nostalgia numerator numerical nutrition
objective obnoxious observing obviously occlusion octagonal operation optically orangutan orchestra
originate oscillate otherwise ourselves outermost outspoken overboard overnight overshoot overwrite
ownership oxidation paparazzi paperclip parachute paragraph parameter parchment partially partition
passenger pathology peninsula pentagram perfectly performer perimeter periphery permanent perpetual
persevere pertinent pervasive phenomena photocopy physician physicist pineapple pistachio pitchfork
placement plausible playhouse pointless policeman political pollution porcelain porcupine portfolio
posterior postulate potential practical pragmatic precedent precisely precision predicate predicted
premature presently president primarily primitive principal principle printable prismatic privately
privilege procedure processor professor projector prominent promotion pronounce propagate propeller
protected protector prototype provision proximity pseudonym publicity publisher puppeteer purchased
purposely quadratic quadruple qualifier quarterly quicksand quotation racehorse radiation radically
randomize raspberry rationale readiness realistic rearrange reasoning recipient recognize recommend
reconcile reconnect recording rectangle recurrent recursion recursive reduction redundant reference
reflected reflexive regarding regularly rejection relevance remainder remaining removable rendering
rendition repeating replicate represent reproduce repulsion requisite reservoir resilient resistant
resonance respected responded resulting resurrect retention retrieval reverence reversing reversion
revolving rewarding sacrifice safeguard satellite satisfied saxophone scarecrow scattered scientist
sculpture secondary secretary sectional seemingly segregate selection selective semaphore semicolon
sensation sensitive separated separator seriously seventeen shipwreck shortcake shorthand shrinkage
shrubbery signature similarly simulator singleton situation slideshow snowboard snowflake snowstorm
sociology something somewhere sophomore southeast southwest spaceship spacesuit spaghetti sparingly
specially specialty speedboat spherical spotlight sprinkler stability stabilize staircase stateless
statement statistic steamboat steepness stiffness stimulate stopwatch strangely strategic stretcher
stringent structure struggled subdivide submarine subscribe subscript substance substrate subsystem
successor suggested summarize summation sunflower superhero supersede surprised surrender surrogate
suspected sweetener swordfish symposium synagogue synthesis synthetic tangerine technical technique
telemetry telephone telescope temperate temporary tentative terminate territory therapist thickness
threshold thrilling throwback thumbnail timestamp timetable tolerable tolerance touchdown trackball
trademark tradition transform transient translate transport transpose trapezium trapezoid traveling
treatment turnstile turquoise twentieth typically unanimous uncertain unchanged undecided undefined
underline undertake uninstall universal unlimited unnoticed unrelated unscathed untouched unusually
unwelcome uppercase uppermost usability valuation variation vegetable verbosity versatile vestigial
vibration victorian viewpoint violation virtually visionary visualize voiceover voltmeter voluntary
volunteer wallpaper warehouse waterfall watermark watershed weirdness welcoming wellbeing whichever
whirlpool whitelist wholesome withdrawn wolverine wonderful workbench workhorse workplace worksheet
workspace worldwide worthless wrestling xylophone yellowish yesterday zookeeper
`,
  10: `
abbreviate absolutely absorption accelerate acceptable acceptance accessible accidental accomplish
accordance accountant accumulate accurately adaptation adequately adjustable adjustment administer
admittedly adventurer affordable aggressive allegation allocation alphabetic alteration altogether
ambassador analytical anatomical annotation announcing anticipate apostrophe apparently appearance
applicable appreciate aquamarine arithmetic artificial assessment assignment assistance assumption
atmosphere attachment attendance attraction attractive authorship automation automobile autonomous
background barbershop basketball battleship beforehand behavioral beneficial biological birthplace
blackberry blackboard borderline bottleneck breadcrumb brightness calculator cantaloupe capability
capitalize cappuccino categorize celebrated centigrade centimeter challenged chancellor changeable
charitable chartreuse checkpoint chessboard chimpanzee circumvent classified classifier coincident
collection collective colorblind commentary commercial commitment comparable comparison compassion
compatible compensate competitor complement completely completion complexity compliance complicate
compliment compromise compulsory concentric conception conceptual concerning conclusion concurrent
conference confidence confluence conformity congestion conjecture connection conscience consistent
consortium constantly constitute constraint consumable contention contextual contiguous contingent
continuity continuous contradict contribute controlled convenient convention conversely conversion
conveyance coordinate cornflower correction correspond corruption counteract courageous courthouse
credential critically crossbones crossroads cumbersome cumulative curriculum deactivate decelerate
decompress decoration decorative decryption dedication deficiency definitely definition definitive
deflection degenerate delegation deliberate delightful democratic demolition department dependable
dependence dependency deployment derivation derivative descendant destructor determined diagnostic
diagonally dictionary difference difficulty disastrous discipline disclosure disconnect discontent
discourage discovered discretion discussion dishwasher dispersion disposable dissimilar distortion
distribute disturbing divergence downstairs downstream drawbridge drawstring durability earthquake
economical efficiency elasticity electrical electronic elementary elliptical employment encryption
engagement enormously enrollment enterprise enthusiasm equivalent escalation especially estimation
evaluation eventually everything everywhere excellence excitement exhaustion exhaustive exhibition
expandable expedition experience experiment expiration explaining explicitly exposition expression
expressive extinction extraction extraneous eyewitness facilitate faithfully federation fellowship
fertilizer fiberglass fictitious fingernail flashlight flattering fluttering footprints foreground
formidable foundation fractional frequently freshwater friendship frightened fulfilling functional
generality generalize generation generative generosity generously geographic goalkeeper governance
government gracefully graduation grandchild grandstand grapefruit gratefully gratuitous greenhouse
groundwork guaranteed gymnastics handsomely healthcare helicopter hemisphere henceforth hesitation
historical homecoming hopelessly horizontal horsepower hospitable hovercraft hyperbolic hypotenuse
hypothesis illuminate illustrate importance impossible impression improbable incidental incoherent
incomplete incredible incredibly indefinite indication indicative indirectly individual industrial
inequality inevitable infinitely informally infrequent ingredient inherently initialize initiation
initiative innovation inspection instructor instrument invitation irrational irrelevant irritation
journalism journalist laboratory legitimate letterhead liberation lighthouse likelihood limitation
linguistic literature litigation locomotive lumberjack luminosity mainstream manageable management
manipulate manuscript marginally mastermind mathematic meaningful measurable mechanical medication
membership memorandum metropolis microphone microscope microscopy millennium milliliter millimeter
minimalist miraculous mistakenly mitigation moderately moderation monitoring monochrome motherhood
motivation motorcycle mozzarella multimedia multiplier mysterious nationwide navigation needlessly
negatively negligence negligible neighborly networking neutrality newsletter nomination nonfiction
nontrivial noteworthy noticeable nourishing obligation obligatory observable occasional occupation
occurrence officially opposition optimistic optionally ordinarily originally ornamental orthogonal
oscillator outperform overweight paddleboat paintbrush palindrome parametric parliament particular
passageway passionate passphrase pathfinder peacefully peacemaker pedestrian peppermint percentage
percentile perception perceptual periodical peripheral periwinkle permission permissive persistent
personable personally persuasive pharmacist phenomenon philosophy phosphorus photograph physically
pickpocket pilgrimage plantation playground playwright polynomial popularity population positively
possession possessive postscript precaution precedence prediction predictive preferable preference
presumably prevailing prevalence prevention previously prioritize production productive profession
proficient profitable prohibited projection prominence proportion prosperity protection protective
protractor provenance providence provincial purposeful pushbutton quaternary questioner rainforest
randomness rationally reactivate reasonable reasonably reassemble reciprocal reconsider recreation
recurrence redemption redundancy refinement reflection reflective refraction regardless regenerate
regression regularity regulation relational relatively relaxation relentless relinquish relocation
remarkable renovation reorganize repeatable repeatedly repertoire repetition repetitive repository
reputation reschedule resilience resistance resolution respective responsive restaurant restricted
revelation reversible revolution rhinoceros ridiculous robustness rotational roundabout salutation
sandcastle sanitation saturation schoolbook scientific scoreboard screenplay screenshot seamlessly
searchable semicircle separately separation sequential silhouette silverware similarity simplicity
simplistic simulation skateboard skyscraper smoothness snowmobile soundtrack specialist springtime
standalone standpoint starvation stationary stereotype storehouse strawberry streamline strengthen
stretching strictness structural subjective submission subsection subsequent subsidiary substitute
subversion succeeding successful succession successive sufficient suggestion supervisor supplement
supposedly surprising surrounded suspension suspicious sweatshirt sweetheart synonymous synthesize
systematic tambourine technician technology television temptation terminator terracotta terrifying
themselves thereafter thermostat thoroughly thoughtful throughout throughput timekeeper toothbrush
toothpaste topography tournament trajectory trampoline transcribe transcript transistor transition
transitive translator transverse tremendous triangular truncation turbulence turnaround turtledove
turtleneck typescript typewriter typography ultimately ultralight unaffected unassigned undergoing
underlying underneath underscore undershirt understand understood undertaken underwater unexpected
unfinished unforeseen uniformity unintended uniqueness university unofficial unpleasant unreadable
unreliable unresolved unsuitable usefulness validation vegetarian vertically visibility vocabulary
volleyball vulnerable watermelon wavelength whatsoever wheelchair whitespace widespread wilderness
windshield wonderland woodpecker workaround worthwhile wraparound xenophobia yesteryear
`,
  11: `
abstraction accelerator accommodate accompanied accordingly achievement acknowledge acquisition
adventurous affiliation afterschool alternately alternative ambiguously anniversary anonymously
application appropriate approximate arbitrarily arrangement association attribution bittersweet
blockbuster boilerplate bookkeeping broadcaster bureaucracy calculation calibration calligraphy
candlestick categorical cauliflower celebration certificate circulation coefficient coincidence
collaborate collapsible combination comfortable commentator communicate comparative compartment
competition compilation composition compression computation conceivable conceivably conditional
consecutive consequence consistency consolidate constituent constructor consumption contaminate
contentious continental contingency continually contraction contractual contributor convenience
convergence convertible cooperation cooperative corporation correlation counterpart cylindrical
dangerously declaration demonstrate denominator description descriptive designation destination
destruction destructive development differently dimensional directional disassemble discrepancy
disjunction disposition distinction distinctive distinguish distributor documentary drastically
duplication dynamically educational effectively efficiently electrician electricity eligibility
elimination embarrassed empirically encapsulate encouraging endorsement enforceable enforcement
engineering enhancement enlargement entertained enumeration environment equilateral equilibrium
equivalence essentially examination exceedingly exceptional excessively exclamation exclusively
existential expectation explanation explanatory exploration exponential extensively extrapolate
fascinating feasibility fingerprint firecracker firefighter flexibility flourishing fluorescent
forecasting formulation fortunately frightening fulfillment fundamental furthermore generically
grammatical grandparent graphically guesstimate handwriting handwritten hexadecimal homogeneous
housekeeper hummingbird hyphenation icosahedron identically illustrated illustrator imagination
immediately implication importantly impractical improvement inalienable incantation incorporate
incorrectly incremental indentation independent indivisible ineffective inefficient inexpensive
influential information informative inheritance insensitive inspiration instability instantiate
institution instruction integration intelligent intentional interaction interactive interchange
interesting interrogate interrupted intuitively investigate involvement irreducible irrevocable
landscaping legislation legislative lightweight lithography logarithmic loudspeaker magnificent
maintenance malfunction manipulator mantelpiece manufacture marketplace marshmallow masterpiece
materialize mathematics meaningless measurement methodology microscopic microsecond millisecond
mischievous mountaineer necessarily negotiation neighboring nightingale nonetheless nonexistent
nonsensical nonstandard numerically observation opinionated opportunity orientation originality
oscillation overwritten paperweight parachuting parallelism parentheses parenthesis participant
participate partnership pedagogical penetration penultimate performance periodicity permanently
permissible permutation persistence personality perspective philosopher photography placeholder
polytechnic portability possibility potentially practically predecessor predictable predictably
predominant prehistoric preliminary prematurely preparation presumption principally probability
problematic procurement programming progression progressive prohibition prominently promotional
propagation proposition proprietary prospective provisional publication punctuation qualitative
quicksilver radioactive rationality rationalize readability realization recognition reconfigure
reconstruct recoverable rectangular recursively redirection refreshment reliability remembrance
replaceable replacement replication requirement resignation respectable responsible restoration
restriction restrictive restructure rudimentary scalability scholarship screwdriver scrumptious
secondarily secretariat segregation selectively sensational sensitivity shamelessly shortcoming
significant singularity spectacular speculation speculative sponsorship spreadsheet springboard
standardize statistical stethoscope stimulation subdivision subordinate subsequence substantial
substantive subtraction suitability superficial superfluous supermarket superscript supervision
suppression susceptible sustainable symmetrical sympathetic synchronize synchronous technically
temperament temperature temporarily tentatively termination terminology theoretical thermometer
threatening thunderbolt topological touchscreen traditional transaction translation translucent
transparent troublesome trustworthy ultramarine unambiguous unavailable unavoidable unavoidably
unbreakable uncertainty underground undertaking undesirable undoubtedly unexplained unfavorable
unforgiving unfortunate unification unimportant universally unknowingly unnecessary unpublished
unqualified unreachable unrealistic unsatisfied unspecified unsubscribe unsupported utilization
vacationing vaccination variability ventilation voluntarily volunteered warehousing wastebasket
whereabouts wherewithal workmanship
`,
  12: `
abbreviation acceleration accidentally accompanying accomplished accumulation additionally
advantageous afterthought aggressively alphabetical amphitheater announcement anticipation
appreciation architecture articulation artificially astronomical astrophysics authenticate
authenticity availability bibliography breakthrough cancellation catastrophic championship
characterize checkerboard choreography circumstance civilization coincidental collaborator
collectively commencement commercially commissioner commonwealth compensation completeness
complication concentrated conceptually concurrently condensation confidential configurable
confirmation congratulate congregation connectivity consequently conservation conservative
considerable considerably consistently constitution constructing construction constructive
consultation contemporary continuation continuously contribution controllable conveniently
conventional conversation coordination cryptography deactivation definitively deliberately
deregulation differential disadvantage disagreement disambiguate disappointed disastrously
discoverable discriminate displacement dissertation distribution dramatically eccentricity
economically electrolytic embarrassing encyclopedia entanglement entertaining enthusiastic
entrepreneur exaggeration exchangeable exhilarating experimental faithfulness finalization
fluorescence foundational friendliness frontispiece functionally geographical hierarchical
hippopotamus historically horizontally horsemanship housekeeping humanitarian hypothetical
identifiable illumination illustration illustrative inaccessible inauguration incandescent
incidentally incomparable incompatible inconclusive inconsistent inconvenient increasingly
indefinitely independence individually inefficiency infrequently infringement installation
insufficient intellectual intelligence interception interference intermediary intermediate
intermittent interruption intersection intervention introduction introductory invisibility
irreversible jurisdiction legitimately localization maintainable manipulation mathematical
maximization meaningfully mechanically merchantable metropolitan minimization misplacement
modification moonlighting multilingual multiplicity multipurpose mysteriously neighborhood
nevertheless nomenclature nonrenewable northeastern notification occasionally optimization
organization orthographic oscilloscope overestimate oversleeping particularly passionately
pathological permeability perseverance persistently perturbation photographer photographic
pleasantness polarization polymorphism precondition prerequisite prescription presentation
preservation presidential productivity professional programmatic proportional psychiatrist
purposefully quantitative questionable reappearance reassignment recognizable recognizably
redefinition redistribute refrigerator regeneration registration rehabilitate relationship
relentlessly reproducible reproduction respectfully respectively ridiculously satisfaction
satisfactory screenwriter segmentation semantically semicircular sequentially shortsighted
significance simultaneous skateboarder sleepwalking snowboarding sociological specifically
spectroscopy sportscaster statistician straightness strengthened structurally subconscious
subparagraph subscription subsequently substitution successfully successively sufficiently
supplemental surprisingly surveillance suspiciously symbolically technologist thermocouple
thoroughfare transferable transitional transmission transparency trigonometry triumphantly
unacceptable unauthorized unbelievable unchangeable uncontrolled unemployment unexpectedly
unidentified unmanageable unreasonable unrecognized unrestricted unstructured unsuccessful
unsupervised unverifiable verification veterinarian
`,
  13: `
accessibility accommodation administrator advertisement alternatively anticlockwise applicability
appropriately approximately approximation architectural argumentative authoritative authorization
autobiography automatically biotechnology certification choreographic chronological circumference
clarification collaboration collaborative commemoration communication compatibility complementary
comprehension comprehensive computational concentration configuration confrontation conscientious
consecutively consequential considerately consideration consolidation constellation contamination
contradiction contradictory controversial counterattack customization decomposition deforestation
demonstration destructively determination differentiate disappearance disconnection discontinuity
discontinuous dissemination dissimilarity documentation dysfunctional effectiveness encapsulation
encouragement enlightenment entertainment environmental establishment exceptionally exponentially
extraordinary extrapolation fragmentation functionality fundamentally geometrically gravitational
heterogeneous idiosyncratic imaginatively impossibility inadvertently inappropriate inconsistency
incontestable inconvenience incorporation independently indeterminate individuality inexperienced
insignificant inspirational instantaneous intelligently intentionally interactively international
interpolation interpretable interrogation intrinsically investigation investigative justification
magnification manifestation manufacturing mathematician mediterranean microorganism miscellaneous
misunderstand modernization monotonically morphological noncommercial normalization observational
opportunistic opportunities orchestration parallelogram participation perpendicular philosophical
possibilities probabilistic progressively provisionally qualification qualitatively questionnaire
radioactivity reforestation reinforcement representable revolutionary semiconductor significantly
sophisticated specification stabilization statistically substantially superposition supplementary
symmetrically synchronously technological theoretically traditionally transcription transparently
triangulation trigonometric typographical unambiguously unanticipated unconditional unconstrained
underestimate understanding unfortunately unnecessarily unpredictable vegetarianism visualization
vulnerability
`,
  14: `
accountability acknowledgment administration administrative aforementioned alphabetically
authentication capitalization categorization characteristic cinematography circumstantial
classification comprehensible conservatively constitutional conventionally correspondence
counterexample dimensionality disambiguation disappointment discouragement discrimination
discriminatory embarrassingly experimentally exponentiation fundamentalism generalization
hierarchically hypothetically identification implementation inconsistently indistinctness
industrialized infrastructure initialization insufficiently intellectually interconnected
interpretation mathematically meteorological methodological multiplication nanotechnology
optimistically organizational overcompensate overpopulation overprotective philanthropist
photosynthesis proportionally quantification recommendation reconciliation reconstruction
redistribution rehabilitation relinquishment representation representative responsibility
responsiveness simplification simultaneously specialization superintendent systematically
transcendental transformation transportation unacknowledged uncontrollable unconventional
underestimated understandable understatement unsuccessfully
`,
  15: `
appropriateness bibliographical characteristics chronologically cinematographic comprehensively
computationally confidentiality congratulations controversially correspondingly counterargument
deindustrialize differentiation disillusionment distinguishable experimentation extraordinarily
inappropriately incompatibility inconsequential inconspicuously individualistic instantaneously
instrumentation interchangeable interchangeably interconnection interdependence internationally
logarithmically maintainability notwithstanding overachievement overcomplicated overrepresented
personalization philosophically photojournalism professionalism proportionately psychologically
reconceptualize recontextualize reproducibility revolutionizing standardization straightforward
synchronization telecommunicate transliteration trustworthiness unconditionally underestimation
underpopulation unintentionally unsophisticated unsportsmanlike
`,
  16: `
characterization compartmentalism compartmentalize counterintuitive disestablishment
disproportionate electromagnetism entrepreneurship environmentalism extraterrestrial
hypersensitivity hyperventilating immunodeficiency incomprehensible incontrovertible
institutionalize internationalism internationalize irresponsibility microengineering
misappropriation misunderstanding multiculturalism multidimensional overcompensation
transcontinental unaccountability uncharacteristic uncompromisingly unconstitutional
unconventionally underachievement underappreciated underrepresented unsustainability
`,
  17: `
constitutionality counterproductive indistinguishable industrialization institutionalized
interdisciplinary intergovernmental internationalized interrelationship irreproducibility
misrepresentation nondiscriminatory overqualification telecommunication
`,
  18: `
deinstitutionalize disproportionately interconnectedness overgeneralization underqualification
`,
  19: `
counterproductively deindustrialization professionalization reindustrialization
`,
  20: `
counterrevolutionary internationalization
`,
};

const EXTENDED_RAW = {
  4: `
acre afar aide airy akin ally alto alum ammo anew ante apex aqua atop aura bald bang barb bark bass
beau bent bile blew blip bloc boar bomb boom bore born bout boxy brew brow buck buff bulk buoy bury
bust buzz cane carp clap clef clog coil cola coma coop cope cork coup cram crux cure damp deaf deem
dent dire dodo doom drab drew drug duel duke dull dupe earl ecru eddy evil fang fare faux fear feat
feet fell felt fiat fist fizz flaw flop flux fore foul funk fury fuss fuzz gall gash gasp gawk geek
germ glib gnat golf goof goth grew grim guru halo hare hate heck hell helm hone honk huff hump hung
hunk hurl hush inky itch jack joey junk kilo kink knew knit knob laid lain lame lean leer levy limb
limo lisp lobe lone lope luxe mage malt mayo mega meme mend meow mere mesa mice mill mitt mojo mold
murk muse muss mute nape neon nerd newt nick nope noun nova numb obey ogre oops opus oral ouch paid
pane pare peep peso phew pike pint pita poke posh posy pout puff punt racy rake rapt rave raze reap
rear rend riff rite romp rote rout ruin rune saga sale sang sari sash scat sham shot sigh sill silo
slab slit slop snip snob snot snug sofa solo spar spit stag stud sung tack tame tarp tart tier tilt
tint tofu toga tome torn toss tram trio twig vale veto volt wand ward ware warp watt weld wick worn
wren yank yeah yeti yuck yule zany zinc
`,
  5: `
abuse acorn admit affix alike alloy ample angry angst anime annex annoy annul anode argon argue
arose aural awake awful axial axiom bacon basin began begun belly biome birth bison bland bleed
bless blind bloat blond blood blown blurb bower braid bravo broad broke burnt buyer cadet cadre
canon carat cargo cease champ cheat chirp choke chomp chord chore churn civil clang clank conic
crank crate creep crude crypt cupid curse death debut decay decor delve demon denim deter devil
diode disco ditch dodgy dread drone dwarf eaten elect elide ember enact envoy epoxy erode ether
evade evict exert expat facet faint fatty fixer flake flaky flare flask flick flier flint flora
fluff focal frail frisk funky fussy gecko genie genre girth glade gleam gloss gnome graft grief
gripe gross grown grunt guile haiku hairy halve hardy havoc heard helix hinge hoist husky idiom
idiot incur inlay islet jerky khaki kitty labor laden lasso leafy ledge limbo liter locus lousy
lucid lumen macho magma maize maker marge matte mauve medic metro midst milky molar moody morph
motif mover naked nasal neigh nexus ninth notch nudge oddly onset ounce overt peril perky petal
picky piggy plaid prism probe promo prone prose purge putty quirk quota ramen recur rehab remix
repel retro rhino roach rodeo salsa saver scour scrap sedan sepia sever shard shear shook shoot
shove shrug shunt sieve sinus skier skunk slack slang slick sling sloth slurp smirk sniff sonic
spade spill spite splat splay spoil squid stall stash steal steed stern stray stump swept swipe
swirl taint taker tally tango taper terse threw triad troll trove truss tweak tweet twine umber
undid undue unfit unmet untie vague viper vista vomit vowel wacky waive whack widen wince winch
wiper woken women wonky woozy wring
`,
  6: `
abacus abrupt absurd accord adhere adverb aerial affirm afraid alpine alumni amulet analog anyhow
arcade ascend asleep assess assure astral auburn aurora avatar baffle ballot bamboo barely beaten
beaver beetle benign blurry bounty breach breath browse brushy brutal buried burlap cannon causal
censor census church cirrus clique cloudy clunky clutch coarse cobalt coffin cohere cohort collar
colony convey copier corona corpus coupon covert critic crunch crusty crutch dahlia damage dangle
darken deduce deduct defeat defect demote denial depart deploy detour devise dictum disarm disown
divert donate doubly driven dynamo eighth elixir emboss encore enfold enlist enrich equate evince
exempt expire expiry extant facade facial faulty fedora fennel finale floppy florin fluent forgot
foster fresco fringe gender gently glitch goblin gothic grille groovy guinea gullet harden harrow
hassle hearty heroic hiatus hijack hooray horror hourly immune impair impish impure income induce
insane insist insure intuit inward jargon jiggle jitter kelvin keypad kimono kindle kindly kosher
laptop lastly latent latino leeway lichen linden liquid lotion loudly lucent magnum makeup mangle
maniac mantel marmot marque mascot mature merman micron midway mighty milieu minion misuse moduli
morale morsel mortal mortar mosaic mosque muzzle myriad neatly neural nimbus ninety nuclei occupy
octave octavo oddity onward oracle orphan outbox outset overly oyster parole parsec partly pastel
patron petite petrol photon pickup pierce pinkie pirate pistol plaque plasma plenty pointy poison
poodle postal priest primal proton proven purify purity pursue quaint quanta quarto racket radian
raster ration realty reboot recast recoil redact redraw refill reflow regime rejoin remade remake
reopen repack replay reside resist retest retina retype revamp revise revive revoke rework ridden
risque rotary rubric russet salute scrape scurry seldom selfie sensor sermon severe shaken shalom
shelve shrank shrimp shrine shrunk sierra signet singly skinny sleeve slowly smiley smithy snazzy
sneaky sortie sought soviet speech speedy spiral splint spoken sprite spruce squish stably stanza
steamy stigma stolen strand streak struck stupid stylus subtly sulfur svelte swatch tactic tandem
teacup tendon threat thrift timely torque triage trivia trough turban tuxedo umlaut uncork undone
uneven unfair unfold unhook unison unload unlock unmask unreal unroll unseen unsure unwind unwise
uproot upshot upward utopia varied vastly viable victor viking virtue voodoo vortex warren weakly
webcam whiten wholly wildly windup wisely wombat worsen wreath wrench wretch yearly yeoman zigzag
zombie
`,
  7: `
actuate adverse advisor aerosol airflow alright amplify analogy anarchy annuity anomaly anybody
anytime appease approve apropos arbiter archaic arsenic artwork audible azimuth babysit baggage
barbell bellhop beneath billion bizarre blacken blindly booklet bouquet braille breadth brevity
briefly broadly brought buildup calcium calorie capsize capsule captive carmine carrier cascade
cathode caveman certify chassis cheaply cheerio chemist chevron citadel clarify clarity cleanly
clutter coexist collate collide commune commute compete concave conceal concern confine confuse
conical conquer copious copycat crochet crucial cryptic culprit cursive cyclone cypress daytime
decibel defrost defunct degrade deprive descend deviate devious dialect dictate diffuse discern
discord disease disrupt dissent distant distill distort disturb diverge diverse dubious durable
eagerly earthly echelon elastic electro elevate elision endnote enlarge entrant envelop equator
erosion erratic ethical evident excerpt explode exploit eyebrow faction factual faculty falafel
falsely fancier farther fearful federal fifteen firstly fission forgery foundry foxtrot fractal
freshly frontal funeral gateway genetic genuine gherkin glucose goodbye gradual greatly griffin
haircut hamburg handbag handout hangout happily harmful harness harpoon hashtag hectare herring
highway himself horizon hydrate imagery imitate implode imprint impulse inbound inertia inferno
inhibit innards insofar interim invoice isotope jointly juniper keynote kinetic largely lateral
lattice leakage leather legally legible lengthy lenient lexicon liaison liberal lighten lightly
linkage luckily luggage madness magnify mailman mandate marquee married martial massage mercury
microbe midyear mileage million mindful minibus mislead montage mugshot naively naughty necktie
neglect neutron nightly noisily nominal nonstop notepad novelty nowhere nucleus obscure octagon
oddball oddness omnibus ongoing optimum orbital ottoman ourself outflow outlier outlive outsize
outward overdue overrun overtly painful paradox parkway parquet partway pathway pendant pensive
pentode persona perturb pilgrim pinball pinkish pollard pollute polymer posture potable poultry
predate preempt preface prelude premier premise presume pretext prolong pronoun propose prosper
provoke prudent pushpin qualify quibble quietly railway rapidly rapport reactor readily rebound
rebuilt recheck reclaim reddish refract refrain regroup reissue replica reprint reroute residue
restate restful rethink retract reunion revisit revolve rightly rowboat rubbish runaway saffron
salvage satchel scenery secrecy seminar sharpen shortly signify silicon sketchy smartly smuggle
snowman solvent someday sparkle spartan spectra standby statute stealth stencil steroid steward
studied stylish stylize sublime subvert suffice surgery surname synonym syringe tableau tabloid
takeout taxicab tedious tensile textile therein thereto thermal tighten tightly toolbox toolkit
topmost torrent torsion tramway travail treetop trellis trident triplet triumph twelfth twofold
unaware unclear uncover undergo unhappy unheard unlucky unravel upfront urgency utilize utterly
vacuous vaguely valence varnish violate viscous visibly voltage warrant wavelet webpage weirdly
welfare whatnot whereby wherein whoever workday worship wrongly
`,
  8: `
abnormal abruptly absurdly abundant actively adhesive adoption advisory affinity agnostic alliance
altitude amethyst amicable anaconda analogue analyses analytic ancestry angstrom anterior aptitude
arguably aromatic assembly attendee attorney automate autonomy aviation backhand backside baguette
banknote barefoot beautify beverage bitterly blowfish bluebird boldface bookworm boutique breakage
breakout brighten brownish bullseye cableway camellia carousel cellular chancery charcoal cleverly
cocktail coherent cohesion coincide collator colorist colorize commence comprise condense confetti
conserve construe contrary converse cookbook cosmetic courtesy covenant crescent cultural cyclical
cylinder darkness daylight deadline deadlock decimate decipher decouple derelict diabetes diagnose
director disagree disclaim disclose disguise disorder displace dissolve distract distress doctoral
dominate donation doubtful downcast downhill downside downtime downward drawback economic eggshell
eighteen electric eleventh eligible encircle encroach entirety epilogue equalize esoteric eviction
exterior fairness faithful fanciful farthest feminine fidelity filament finitely firewall firmware
fixation flatness flexibly folklore forcibly foreword formally formerly fountain fourteen friction
furthest goodness granular graphite greedily greenish guardian handball handheld haystack hibiscus
historic honeybee honeydew horrible horribly humanity humanize humidity ignition ignorant imminent
immortal imperial improper impurity inferior infringe inherent injector instruct intermix intimate
intrepid invasive issuance joystick judicial kilogram knockout lawfully leverage lifeline lifespan
likeness lipstick literate locality longhand luminous mahogany mainland mainline mandarin manifold
marriage masthead medieval memorize meridian metallic mitigate mnemonic moccasin modality modulate
monetary moneybag monorail monotone mortgage motorway mulberry mustache mutilate nameless namesake
nautical nearness needless nineteen nowadays nuisance numerous nutshell occupied omission oncoming
optimist orthodox outbound outlying outright outweigh overhang overhaul overkill oversize pamphlet
parabola paradigm paranoia paranoid parasite parental parlance peculiar penalize pendulum pentagon
perceive perverse phonetic phosphor pinpoint platinum platonic playback playbook playlist polarity
postpone preclude premiere pristine probable proclaim prohibit prologue promptly protrude punitive
pursuant quantify radiance railroad reactive reassign redesign redshift relaunch reliance relocate
remotely renegade resemble resistor reversal rigidity rigorous robustly rollover rootless salesman
sameness saturate sauropod sawtooth scaffold scavenge scramble seamless seasonal secondly securely
seedling selenium sensibly serially severely shamrock shortage showtime shrunken signpost slowdown
smoothly snowball softball solidity solvable somebody sometime spearman specular squiggle squiggly
standout sterling stratify stretchy stupidly subtlety succinct suddenly suitably superior supplant
supplier swimsuit syllable synopsis tableaux tabulate takeover teardrop teletype temporal tenacity
tendency terminus terribly tertiary thirteen topology totality transact transmit trickery twilight
typeface ubiquity ugliness unbiased underage underlay underset upcoming usefully vanguard vignette
weakness whiteout wisteria withdraw workload
`,
  9: `

`,
  10: `

`,
  11: `

`,
  12: `

`,
  13: `

`,
  14: `

`,
  15: `

`,
  16: `

`,
  17: `

`,
  18: `

`,
  19: `

`,
  20: `

`,
};

function toList(raw) {
  const out = {};
  for (const [len, text] of Object.entries(raw)) out[len] = text.split(/\s+/).filter(Boolean);
  return out;
}

export const CORE_WORDS = toList(CORE_RAW);
export const EXTENDED_WORDS = toList(EXTENDED_RAW);

export const ANSWER_WORDS = {};
for (let n = 4; n <= 20; n++) {
  ANSWER_WORDS[n] = [...(CORE_WORDS[n] || []), ...(EXTENDED_WORDS[n] || [])];
}

// Fast lookup used by the difficulty engine.
export const EXTENDED_WORD_SET = new Set(Object.values(EXTENDED_WORDS).flat());

export const MIN_WORD_LENGTH = 4;
export const MAX_WORD_LENGTH = 20;
