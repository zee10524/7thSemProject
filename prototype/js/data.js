/* ==========================================================================
   LitSense prototype - DATA
   --------------------------------------------------------------------------
   Pure mock data. No DOM, no state, no side effects.
   When the MERN backend exists, every export here maps to a MongoDB
   collection or an API response (see README, "Replacing mock data").

   Exports (window.LitSense.data):
     config, aspects, aspectCopy, books, users, readerProfile,
     recommendations, neighbors, reviews, seedShelf, seedActivity,
     lexicon, sampleReview, genreFilters, moodFilters, demos
   ========================================================================== */
(function (global) {
  'use strict';

  var LS = (global.LitSense = global.LitSense || {});

  /* ------------------------------------------------------------------ */
  /* Config                                                              */
  /* ------------------------------------------------------------------ */
  var config = {
    appName: 'LitSense',
    tagline: 'Review-aware · Explainable · Conversational',
    epigraph: 'From knowing what a reader liked, to understanding why they liked it.',
    // Real covers come from Open Library by cover id. CSS covers always render
    // underneath, so the UI still looks designed if an image fails or you are offline.
    remoteCovers: true,
    coverBase: 'https://covers.openlibrary.org/b/id/',
    storageKey: 'litsense.prototype.v1'
  };

  /* ------------------------------------------------------------------ */
  /* The 12 literary aspects (same order as the project presentation)    */
  /*   kind 'quality': higher book score is better, weighted by how much */
  /*                   the reader cares (profile score).                 */
  /*   kind 'dial':    the reader has a preferred LEVEL; distance hurts. */
  /* ------------------------------------------------------------------ */
  var aspects = [
    { key: 'plot',       no: '01', label: 'Plot',             kind: 'quality', wmax: 6 },
    { key: 'writing',    no: '02', label: 'Writing style',    kind: 'quality', wmax: 11 },
    { key: 'characters', no: '03', label: 'Characters',       kind: 'quality', wmax: 11 },
    { key: 'world',      no: '04', label: 'World building',   kind: 'quality', wmax: 9 },
    { key: 'pacing',     no: '05', label: 'Pacing',           kind: 'dial' },
    { key: 'editing',    no: '06', label: 'Editing quality',  kind: 'quality', wmax: 3 },
    { key: 'dialogue',   no: '07', label: 'Dialogue',         kind: 'quality', wmax: 4 },
    { key: 'humor',      no: '08', label: 'Humor',            kind: 'quality', wmax: 4 },
    { key: 'emotion',    no: '09', label: 'Emotional impact', kind: 'quality', wmax: 11 },
    { key: 'ending',     no: '10', label: 'Ending',           kind: 'quality', wmax: 4 },
    { key: 'complexity', no: '11', label: 'Complexity',       kind: 'dial' },
    { key: 'darkness',   no: '12', label: 'Tone / darkness',  kind: 'dial' }
  ];

  /* Language used to explain each aspect. */
  var aspectCopy = {
    plot:       { love: 'tightly plotted stories',      rated: 'plot',                reason: 'Gripping, well-built plot',      low: 'Looser plotting',               high: 'More plot-driven than you like' },
    writing:    { love: 'lyrical, polished prose',      rated: 'lyrical prose',       reason: 'Lyrical, polished prose',        low: 'Plainer prose than you like',   high: 'Very ornate prose' },
    characters: { love: 'character-driven stories',     rated: 'character development', reason: 'Strong character relationships', low: 'Thinner character work',        high: 'Character-heavy' },
    world:      { love: 'immersive worlds',             rated: 'immersive world building', reason: 'Immersive world building',    low: 'Lighter on world building',     high: 'Very dense world building' },
    pacing:     { love: 'a steady, absorbing pace',     rated: 'pacing',              reason: 'Pacing that suits you',          low: 'Slower pacing',                 high: 'Faster pacing than you like' },
    editing:    { love: 'carefully edited storytelling', rated: 'editing quality',    reason: 'Clean, careful editing',         low: 'Rougher editing',               high: 'Very polished' },
    dialogue:   { love: 'sharp, natural dialogue',      rated: 'dialogue',            reason: 'Sharp, natural dialogue',        low: 'Stiffer dialogue',              high: 'Dialogue-heavy' },
    humor:      { love: 'warm humor',                   rated: 'humor',               reason: 'Warm, well-placed humor',        low: 'Very little humor',             high: 'Jokier than you like' },
    emotion:    { love: 'strong emotional arcs',        rated: 'emotional impact',    reason: 'Emotional storytelling',         low: 'Emotionally reserved',          high: 'Emotionally intense' },
    ending:     { love: 'satisfying endings',           rated: 'endings',             reason: 'A satisfying ending',            low: 'A looser ending',               high: 'A decisive ending' },
    complexity: { love: 'layered, readable ideas',      rated: 'complexity',          reason: 'Comfortably layered',            low: 'Simpler than your usual',       high: 'More complex than you like' },
    darkness:   { love: 'a humane, balanced tone',      rated: 'tone',                reason: 'A tone close to yours',          low: 'Lighter than your usual',       high: 'Darker than your usual' }
  };

  /* ------------------------------------------------------------------ */
  /* Books                                                               */
  /*   aspects are review-derived scores 0-100, built with A():          */
  /*   A(plot, writing, characters, world, pacing, editing, dialogue,    */
  /*     humor, emotion, ending, complexity, darkness)                   */
  /*   cover: { id: Open Library cover id, c1, c2, ink, accent, motif,   */
  /*            layout, font } - the CSS cover uses everything but id.    */
  /* ------------------------------------------------------------------ */
  function A(plot, writing, characters, world, pacing, editing, dialogue, humor, emotion, ending, complexity, darkness) {
    return {
      plot: plot, writing: writing, characters: characters, world: world, pacing: pacing, editing: editing,
      dialogue: dialogue, humor: humor, emotion: emotion, ending: ending, complexity: complexity, darkness: darkness
    };
  }

  var books = [
    {
      id: 'project-hail-mary', title: 'Project Hail Mary', author: 'Andy Weir', year: 2021, pages: 476,
      genres: ['Science fiction', 'Adventure'], moods: ['adventurous', 'funny', 'hopeful', 'thoughtful'],
      rating: 4.8, ratingsK: 1500,
      tagline: 'One astronaut, one impossible friendship.',
      desc: 'Ryland Grace wakes alone on a spacecraft with no memory and a mission that will decide the fate of Earth. Armed with improvised science and a stubborn streak, he finds that the strangest help comes from the most unlikely friend.',
      aspects: A(92, 86, 86, 96, 78, 86, 84, 86, 84, 94, 68, 46),
      cover: { id: 12455001, c1: '#14283a', c2: '#2f6f8f', ink: '#f6efe3', accent: '#f0b955', motif: 'orbit', layout: 'center', font: 'serif' }
    },
    {
      id: 'the-song-of-achilles', title: 'The Song of Achilles', author: 'Madeline Miller', year: 2011, pages: 378,
      genres: ['Historical fantasy', 'Romance', 'Mythology'], moods: ['emotional', 'atmospheric'],
      rating: 4.7, ratingsK: 1100,
      tagline: 'A tender love story with a war closing in.',
      desc: 'Patroclus, a quiet exiled prince, is drawn into the orbit of golden Achilles. Their friendship deepens into love as the shadow of the Trojan War closes in, in a retelling that is as tender as it is devastating.',
      aspects: A(84, 95, 97, 86, 40, 86, 84, 55, 98, 94, 58, 55),
      cover: { id: 15160443, c1: '#2d1a12', c2: '#9b4a2b', ink: '#f6efe3', accent: '#e9c27a', motif: 'meander', layout: 'frame', font: 'serif' }
    },
    {
      id: 'klara-and-the-sun', title: 'Klara and the Sun', author: 'Kazuo Ishiguro', year: 2021, pages: 303,
      genres: ['Literary fiction', 'Science fiction'], moods: ['cozy', 'quiet', 'emotional', 'thoughtful'],
      rating: 4.5, ratingsK: 220,
      tagline: 'A gentle machine watches over a fragile family.',
      desc: 'Klara is an Artificial Friend who studies the world from a shop window, waiting for a child to choose her. Once she does, she watches over a fragile family and keeps faith in the power of the Sun.',
      aspects: A(76, 96, 88, 84, 38, 90, 74, 46, 92, 84, 60, 40),
      cover: { id: 10673548, c1: '#f1b84a', c2: '#e07a3b', ink: '#2a1608', accent: '#fff1c9', motif: 'sun', layout: 'top', font: 'serif' }
    },
    {
      id: 'the-midnight-library', title: 'The Midnight Library', author: 'Matt Haig', year: 2020, pages: 304,
      genres: ['Fantasy', 'Contemporary fiction'], moods: ['hopeful', 'thoughtful'],
      rating: 4.3, ratingsK: 1300,
      tagline: 'Every life you could have lived, on a shelf.',
      desc: 'Between life and death, Nora Seed finds a library where every book is a life she could have lived. She sets out to find the one worth keeping.',
      aspects: A(82, 70, 74, 78, 78, 80, 72, 66, 86, 84, 42, 50),
      cover: { id: 15164860, c1: '#0d1f2d', c2: '#1f5266', ink: '#eaf3ee', accent: '#9ed3c9', motif: 'arches', layout: 'center', font: 'serif' }
    },
    {
      id: 'tomorrow-and-tomorrow-and-tomorrow', title: 'Tomorrow, and Tomorrow, and Tomorrow', author: 'Gabrielle Zevin', year: 2022, pages: 416,
      genres: ['Literary fiction', 'Contemporary fiction'], moods: ['emotional', 'hopeful', 'thoughtful'],
      rating: 4.6, ratingsK: 480,
      tagline: 'Two friends, three decades, one game.',
      desc: 'Two childhood friends reunite in college and begin building video games together. Over three decades of ambition, rivalry and grief, the games become the place where they love each other best.',
      aspects: A(82, 92, 96, 80, 66, 86, 90, 78, 92, 84, 68, 46),
      cover: { id: 12816990, c1: '#d9493a', c2: '#f0a63a', ink: '#fff7ea', accent: '#1d1a16', motif: 'pixels', layout: 'bold', font: 'sans' }
    },
    {
      id: 'the-silent-patient', title: 'The Silent Patient', author: 'Alex Michaelides', year: 2019, pages: 336,
      genres: ['Thriller', 'Mystery'], moods: ['dark', 'atmospheric'],
      rating: 4.3, ratingsK: 1700,
      tagline: 'A woman who will not speak, a man who must know.',
      desc: 'Alicia Berenson shot her husband and has not spoken since. Theo Faber, a psychotherapist, is determined to make her talk, and to find out what really happened.',
      aspects: A(94, 66, 70, 52, 90, 78, 70, 20, 62, 92, 62, 86),
      cover: { id: 8415060, c1: '#efe9de', c2: '#d4ccbc', ink: '#1b1a18', accent: '#b3261e', motif: 'eye', layout: 'band', font: 'serif' }
    },
    {
      id: 'atomic-habits', title: 'Atomic Habits', author: 'James Clear', year: 2018, pages: 320,
      genres: ['Self-help', 'Nonfiction'], moods: ['hopeful', 'thoughtful'],
      rating: 4.6, ratingsK: 1300,
      tagline: 'Tiny changes, remarkable results.',
      desc: 'A practical guide to building good habits and breaking bad ones. Clear argues that small changes, repeated every day, compound into remarkable results.',
      aspects: A(55, 74, 40, 35, 78, 90, 40, 48, 55, 60, 40, 10),
      cover: { id: 12539702, c1: '#f2c230', c2: '#e0a30a', ink: '#1a1a1a', accent: '#1a1a1a', motif: 'atom', layout: 'bold', font: 'sans' }
    },
    {
      id: 'norwegian-wood', title: 'Norwegian Wood', author: 'Haruki Murakami', year: 1987, pages: 296,
      genres: ['Literary fiction', 'Romance'], moods: ['quiet', 'emotional', 'atmospheric'],
      rating: 4.2, ratingsK: 650,
      tagline: 'Memory, grief and a quiet kind of love.',
      desc: 'Toru Watanabe looks back on the 1960s and on the fragile, luminous Naoko, whom he loved. A coming-of-age story about grief, desire and learning to stay alive.',
      aspects: A(56, 90, 88, 66, 42, 80, 76, 40, 90, 70, 55, 66),
      cover: { id: 6376119, c1: '#1c2f25', c2: '#3a6650', ink: '#f2ead8', accent: '#d9a95b', motif: 'pines', layout: 'center', font: 'serif' }
    },
    {
      id: 'the-alchemist', title: 'The Alchemist', author: 'Paulo Coelho', year: 1988, pages: 208,
      genres: ['Fable', 'Adventure'], moods: ['hopeful', 'thoughtful'],
      rating: 4.1, ratingsK: 3500,
      tagline: 'A shepherd follows a dream to the pyramids.',
      desc: 'Santiago, an Andalusian shepherd boy, follows a recurring dream to the Egyptian pyramids. On the road he learns to read the signs the world leaves for those who listen.',
      aspects: A(60, 66, 50, 74, 72, 76, 50, 40, 60, 76, 28, 12),
      cover: { id: 15091614, c1: '#b8601f', c2: '#efae5a', ink: '#2b1507', accent: '#fff0cf', motif: 'pyramid', layout: 'top', font: 'serif' }
    },
    {
      id: '1984', title: '1984', author: 'George Orwell', year: 1949, pages: 328,
      genres: ['Dystopian', 'Classic'], moods: ['dark', 'thoughtful'],
      rating: 4.5, ratingsK: 4600,
      tagline: 'A world where the Party controls the past.',
      desc: 'Winston Smith works rewriting history for a Party that watches everything. His small, secret acts of rebellion lead him toward a love, and a reckoning, he cannot escape.',
      aspects: A(84, 86, 72, 94, 62, 80, 56, 20, 78, 88, 78, 94),
      cover: { id: 15257452, c1: '#161616', c2: '#8c1c1c', ink: '#f1ede4', accent: '#f1ede4', motif: 'eye', layout: 'bold', font: 'sans' }
    },
    {
      id: 'the-seven-husbands-of-evelyn-hugo', title: 'The Seven Husbands of Evelyn Hugo', author: 'Taylor Jenkins Reid', year: 2017, pages: 389,
      genres: ['Historical fiction', 'Romance'], moods: ['emotional'],
      rating: 4.7, ratingsK: 1700,
      tagline: 'Seven marriages, one great love.',
      desc: 'Reclusive Hollywood icon Evelyn Hugo finally agrees to tell her story to an unknown journalist. Seven marriages later, the truth about the love of her life is waiting.',
      aspects: A(86, 80, 94, 70, 82, 80, 86, 62, 94, 86, 44, 48),
      cover: { id: 15255141, c1: '#0f1f1e', c2: '#1d4a45', ink: '#f3e7c8', accent: '#e2bb62', motif: 'fan', layout: 'frame', font: 'serif' }
    },
    {
      id: 'a-man-called-ove', title: 'A Man Called Ove', author: 'Fredrik Backman', year: 2012, pages: 337,
      genres: ['Contemporary fiction', 'Humor'], moods: ['funny', 'emotional', 'cozy', 'hopeful'],
      rating: 4.7, ratingsK: 1000,
      tagline: 'A grumpy man who is not done living.',
      desc: 'Ove is a grumpy widower with firm opinions about parking and a plan to end his life. New neighbours keep getting in the way, and slowly bring him back to the living.',
      aspects: A(70, 80, 94, 60, 66, 82, 82, 88, 94, 88, 28, 36),
      cover: { id: 8314262, c1: '#2f4858', c2: '#7f9fae', ink: '#fdf6ea', accent: '#e4572e', motif: 'house', layout: 'center', font: 'serif' }
    },
    {
      id: 'the-martian', title: 'The Martian', author: 'Andy Weir', year: 2011, pages: 369,
      genres: ['Science fiction', 'Adventure'], moods: ['funny', 'adventurous'],
      rating: 4.7, ratingsK: 1300,
      tagline: 'Alone on Mars with duct tape and math.',
      desc: 'Stranded on Mars after a dust storm forces his crew to flee, botanist Mark Watney has to science his way to survival. With wit as sharp as his math, he turns every problem into a plan.',
      aspects: A(94, 74, 80, 78, 90, 82, 82, 94, 72, 88, 70, 34),
      cover: { id: 11446888, c1: '#3a120d', c2: '#c4482b', ink: '#fff0e0', accent: '#ffd9a8', motif: 'planet', layout: 'bold', font: 'sans' }
    },
    {
      id: 'circe', title: 'Circe', author: 'Madeline Miller', year: 2018, pages: 393,
      genres: ['Fantasy', 'Mythology'], moods: ['atmospheric', 'emotional'],
      rating: 4.6, ratingsK: 800,
      tagline: 'A witch, an island, and the gods at her door.',
      desc: 'Banished to a remote island, the witch Circe hones her craft among gods, monsters and mortals. A retelling of the Odyssey told with patience and fire.',
      aspects: A(78, 96, 92, 92, 52, 88, 76, 48, 88, 86, 66, 56),
      cover: { id: 8283869, c1: '#14242a', c2: '#3d6b62', ink: '#f4ead2', accent: '#e6b65c', motif: 'waves', layout: 'frame', font: 'serif' }
    },
    {
      id: 'never-let-me-go', title: 'Never Let Me Go', author: 'Kazuo Ishiguro', year: 2005, pages: 288,
      genres: ['Literary fiction', 'Dystopian'], moods: ['quiet', 'emotional', 'atmospheric'],
      rating: 4.2, ratingsK: 750,
      tagline: 'A quiet novel that hurts for a long time.',
      desc: 'Kathy looks back on her years at Hailsham, a boarding school with a strange purpose, and on her friendships with Ruth and Tommy. A quiet novel that hurts for a long time.',
      aspects: A(70, 90, 90, 78, 32, 90, 70, 20, 94, 90, 64, 68),
      cover: { id: 13160732, c1: '#dfe6ea', c2: '#a9bcc6', ink: '#1d2a31', accent: '#3c5666', motif: 'horizon', layout: 'top', font: 'serif' }
    },
    {
      id: 'anxious-people', title: 'Anxious People', author: 'Fredrik Backman', year: 2019, pages: 352,
      genres: ['Contemporary fiction', 'Humor'], moods: ['funny', 'emotional', 'cozy'],
      rating: 4.4, ratingsK: 500,
      tagline: 'A hostage situation with a lot of heart.',
      desc: 'A failed bank robber takes a group of strangers hostage at an apartment viewing. As the standoff unravels, each of them reveals the small sadnesses they carry.',
      aspects: A(80, 78, 92, 56, 74, 76, 88, 94, 90, 86, 36, 40),
      cover: { id: 10087939, c1: '#e9b44c', c2: '#2c7a7b', ink: '#162224', accent: '#fff4d6', motif: 'windows', layout: 'band', font: 'sans' }
    },
    {
      id: 'beartown', title: 'Beartown', author: 'Fredrik Backman', year: 2016, pages: 432,
      genres: ['Contemporary fiction', 'Sports'], moods: ['emotional'],
      rating: 4.5, ratingsK: 330,
      tagline: 'A town, a team, and a choice.',
      desc: 'In a failing forest town, hope rests on a junior ice hockey team. When a shocking event divides the community, everyone must decide what they are willing to protect.',
      aspects: A(80, 84, 94, 72, 58, 80, 82, 52, 94, 80, 54, 72),
      cover: { id: 14820745, c1: '#101c28', c2: '#3d6585', ink: '#eef4f8', accent: '#bfe0f2', motif: 'pines', layout: 'bold', font: 'sans' }
    },
    {
      id: 'daisy-jones-and-the-six', title: 'Daisy Jones & The Six', author: 'Taylor Jenkins Reid', year: 2019, pages: 368,
      genres: ['Historical fiction', 'Music'], moods: ['emotional'],
      rating: 4.4, ratingsK: 1100,
      tagline: 'A rock band, told in many voices.',
      desc: 'An oral history of a 1970s rock band that rose too fast and broke up at the height of its fame. Everyone remembers the story differently.',
      aspects: A(76, 78, 88, 78, 78, 74, 94, 56, 82, 80, 50, 58),
      cover: { id: 8742674, c1: '#e8693a', c2: '#f4b942', ink: '#3a1409', accent: '#fff1d0', motif: 'stripes', layout: 'center', font: 'serif' }
    },
    {
      id: 'piranesi', title: 'Piranesi', author: 'Susanna Clarke', year: 2020, pages: 272,
      genres: ['Fantasy', 'Mystery'], moods: ['atmospheric', 'quiet', 'thoughtful'],
      rating: 4.4, ratingsK: 260, gem: true,
      tagline: 'A house with endless halls and a secret.',
      desc: 'Piranesi lives in a vast house of endless halls, statues and tides. His journals record a gentle life of exploration, until messages begin to appear that suggest he is not alone.',
      aspects: A(82, 94, 78, 98, 50, 90, 62, 40, 76, 92, 78, 40),
      cover: { id: 10226290, c1: '#1c3548', c2: '#7fa7b8', ink: '#f5f1e6', accent: '#eadfbd', motif: 'halls', layout: 'center', font: 'serif' }
    },
    {
      id: 'legends-and-lattes', title: 'Legends & Lattes', author: 'Travis Baldree', year: 2022, pages: 296,
      genres: ['Cozy fantasy', 'Fantasy'], moods: ['cozy', 'hopeful', 'funny'],
      rating: 4.5, ratingsK: 240, gem: true,
      tagline: 'Swords down, coffee up.',
      desc: 'Viv, a retired orc mercenary, hangs up her sword to open the first coffee shop in the city of Thune. A low-stakes tale about found family and very good coffee.',
      aspects: A(60, 70, 86, 82, 64, 82, 80, 74, 78, 80, 22, 12),
      cover: { id: 13028635, c1: '#f3e6cf', c2: '#d9b98a', ink: '#3b2314', accent: '#a8532f', motif: 'mug', layout: 'frame', font: 'serif' }
    },
    {
      id: 'the-house-in-the-cerulean-sea', title: 'The House in the Cerulean Sea', author: 'TJ Klune', year: 2020, pages: 396,
      genres: ['Fantasy', 'Cozy fantasy'], moods: ['cozy', 'funny', 'hopeful', 'emotional'],
      rating: 4.6, ratingsK: 900,
      tagline: 'A strange orphanage on a faraway island.',
      desc: 'A caseworker for magical youth is sent to inspect an orphanage on a remote island. Six unusual children and their mysterious guardian change everything he thought he knew.',
      aspects: A(66, 74, 92, 86, 62, 74, 82, 86, 86, 82, 26, 14),
      cover: { id: 9312772, c1: '#0e5f9a', c2: '#66c0dd', ink: '#fffdf2', accent: '#ffd569', motif: 'isle', layout: 'center', font: 'serif' }
    },
    {
      id: 'station-eleven', title: 'Station Eleven', author: 'Emily St. John Mandel', year: 2014, pages: 333,
      genres: ['Post-apocalyptic', 'Literary fiction'], moods: ['atmospheric', 'hopeful', 'thoughtful'],
      rating: 4.3, ratingsK: 800,
      tagline: 'After the collapse, the art goes on.',
      desc: 'A flu pandemic ends the modern world. Twenty years on, a travelling Shakespeare company moves through a changed landscape, held together by art and memory.',
      aspects: A(82, 92, 84, 92, 54, 88, 70, 36, 84, 86, 78, 74),
      cover: { id: 7369961, c1: '#0f1626', c2: '#2c3f66', ink: '#f1ece0', accent: '#e1c36b', motif: 'stars', layout: 'center', font: 'serif' }
    },
    {
      id: 'a-gentleman-in-moscow', title: 'A Gentleman in Moscow', author: 'Amor Towles', year: 2016, pages: 462,
      genres: ['Historical fiction'], moods: ['cozy', 'funny', 'hopeful', 'thoughtful'],
      rating: 4.6, ratingsK: 800,
      tagline: 'A count, a hotel, a whole life.',
      desc: 'In 1922 Count Rostov is sentenced to house arrest in a grand Moscow hotel. Confined to its rooms, he finds a larger life than he ever expected.',
      aspects: A(70, 94, 94, 90, 44, 90, 86, 82, 86, 90, 56, 28),
      cover: { id: 11563116, c1: '#4a0f14', c2: '#8e2a2f', ink: '#f6e8c8', accent: '#e2b95b', motif: 'dome', layout: 'frame', font: 'serif' }
    },
    {
      id: 'the-night-circus', title: 'The Night Circus', author: 'Erin Morgenstern', year: 2011, pages: 387,
      genres: ['Fantasy', 'Romance'], moods: ['atmospheric'],
      rating: 4.3, ratingsK: 1100,
      tagline: 'A circus that arrives without warning.',
      desc: 'Le Cirque des Rêves arrives without warning and opens only at night. Within its black and white tents, two young magicians are locked in a contest neither of them chose.',
      aspects: A(66, 92, 66, 98, 44, 80, 60, 34, 72, 76, 62, 54),
      cover: { id: 8750523, c1: '#0b0b0e', c2: '#22222a', ink: '#f2f0ea', accent: '#d8322b', motif: 'tent', layout: 'top', font: 'serif' }
    },
    {
      id: 'kafka-on-the-shore', title: 'Kafka on the Shore', author: 'Haruki Murakami', year: 2002, pages: 467,
      genres: ['Magical realism', 'Literary fiction'], moods: ['atmospheric', 'thoughtful'],
      rating: 4.3, ratingsK: 450,
      tagline: 'Two journeys, one strange destiny.',
      desc: 'A teenage runaway and an aging man who talks to cats travel on parallel paths. Dreams, prophecies and a small private library pull them toward the same place.',
      aspects: A(70, 90, 78, 88, 52, 78, 74, 54, 72, 62, 92, 68),
      cover: { id: 6376109, c1: '#12304a', c2: '#e68a3c', ink: '#fff6e6', accent: '#fff6e6', motif: 'waves', layout: 'band', font: 'sans' }
    },
    {
      id: 'small-things-like-these', title: 'Small Things Like These', author: 'Claire Keegan', year: 2021, pages: 116,
      genres: ['Literary fiction', 'Historical fiction'], moods: ['quiet', 'emotional'],
      rating: 4.1, ratingsK: 150, gem: true,
      tagline: 'One quiet decision in a small town.',
      desc: 'Bill Furlong, a coal merchant in 1985 Ireland, makes a discovery at the local convent. One quiet decision tests what he owes to other people.',
      aspects: A(60, 92, 86, 66, 48, 94, 62, 18, 90, 82, 40, 58),
      cover: { id: 15096821, c1: '#cfd7d3', c2: '#8fa49c', ink: '#1b2a26', accent: '#fdfbf4', motif: 'house', layout: 'top', font: 'serif' }
    },
    {
      id: 'the-secret-history', title: 'The Secret History', author: 'Donna Tartt', year: 1992, pages: 559,
      genres: ['Dark academia', 'Mystery'], moods: ['dark', 'atmospheric'],
      rating: 4.3, ratingsK: 800,
      tagline: 'Classics students and a shared secret.',
      desc: 'At a small Vermont college, a group of Classics students falls under the spell of their charismatic professor. A murder is only the beginning of what they will cover up.',
      aspects: A(80, 94, 88, 80, 44, 82, 82, 52, 74, 82, 84, 90),
      cover: { id: 7891406, c1: '#0e1a14', c2: '#2b4636', ink: '#ece3cf', accent: '#c9ab63', motif: 'laurel', layout: 'frame', font: 'serif' }
    },
    {
      id: 'dune', title: 'Dune', author: 'Frank Herbert', year: 1965, pages: 612,
      genres: ['Science fiction', 'Epic'], moods: ['adventurous', 'thoughtful'],
      rating: 4.6, ratingsK: 1100,
      tagline: 'Power, prophecy and a planet of sand.',
      desc: 'On the desert planet Arrakis, young Paul Atreides inherits a dangerous fate. Politics, ecology and prophecy converge around the spice that powers the empire.',
      aspects: A(90, 84, 76, 100, 40, 78, 66, 14, 62, 78, 96, 62),
      cover: { id: 15110282, c1: '#2b160a', c2: '#d9812a', ink: '#fdf0d8', accent: '#ffd28a', motif: 'dunes', layout: 'center', font: 'serif' }
    },
    {
      id: 'the-road', title: 'The Road', author: 'Cormac McCarthy', year: 2006, pages: 287,
      genres: ['Post-apocalyptic', 'Literary fiction'], moods: ['dark', 'emotional'],
      rating: 4.1, ratingsK: 800,
      tagline: 'A father, a son, and the road.',
      desc: 'A father and his young son walk through a burned America, carrying fire and little else. A spare, devastating story about what it means to keep going.',
      aspects: A(66, 92, 78, 78, 56, 86, 58, 10, 88, 76, 44, 98),
      cover: { id: 14818100, c1: '#1c1c1c', c2: '#5b5b5b', ink: '#eeeeee', accent: '#bdbdbd', motif: 'road', layout: 'top', font: 'serif' }
    },
    {
      id: 'pachinko', title: 'Pachinko', author: 'Min Jin Lee', year: 2017, pages: 496,
      genres: ['Historical fiction', 'Family saga'], moods: ['emotional'],
      rating: 4.6, ratingsK: 400,
      tagline: 'Four generations, two countries, one family.',
      desc: 'Four generations of a Korean family make a life in Japan, facing prejudice with grit. A sweeping story of survival, shame and quiet love.',
      aspects: A(78, 88, 94, 90, 46, 82, 78, 44, 92, 84, 62, 56),
      cover: { id: 14829324, c1: '#f1ece0', c2: '#e1d6bf', ink: '#1a1a1a', accent: '#c8312b', motif: 'dots', layout: 'band', font: 'serif' }
    },
    {
      id: 'convenience-store-woman', title: 'Convenience Store Woman', author: 'Sayaka Murata', year: 2016, pages: 163,
      genres: ['Literary fiction', 'Humor'], moods: ['funny', 'quiet'],
      rating: 4.0, ratingsK: 250, gem: true,
      tagline: 'A woman who belongs in the shop.',
      desc: 'Keiko has worked at the same convenience store for eighteen years and feels most herself there. Pressure to live a more normal life arrives in the form of an unlikely new coworker.',
      aspects: A(62, 80, 78, 56, 66, 86, 76, 78, 66, 84, 30, 30),
      cover: { id: 9315164, c1: '#4fb6a8', c2: '#f4f1e8', ink: '#112a28', accent: '#f0615a', motif: 'awning', layout: 'top', font: 'sans' }
    },
    {
      id: 'stoner', title: 'Stoner', author: 'John Williams', year: 1965, pages: 278,
      genres: ['Literary fiction', 'Classic'], moods: ['quiet', 'emotional'],
      rating: 4.3, ratingsK: 120, gem: true,
      tagline: 'A quiet life, fully seen.',
      desc: 'William Stoner, the son of a farmer, discovers a love of literature and spends his life as a university teacher. A quiet novel about work, love and what a life amounts to.',
      aspects: A(58, 94, 88, 60, 34, 90, 70, 36, 90, 86, 48, 54),
      cover: { id: 8310729, c1: '#2b3a33', c2: '#6b7d73', ink: '#f1efe6', accent: '#d8d1b8', motif: 'books', layout: 'top', font: 'serif' }
    },
    {
      id: 'the-long-way-to-a-small-angry-planet', title: 'The Long Way to a Small, Angry Planet', author: 'Becky Chambers', year: 2014, pages: 404,
      genres: ['Science fiction', 'Adventure'], moods: ['cozy', 'hopeful', 'adventurous'],
      rating: 4.4, ratingsK: 480,
      tagline: 'A found family crosses the galaxy.',
      desc: 'Rosemary joins the crew of the Wayfarer, a patched-together ship that punches tunnels through space. Between jobs, the oddball crew becomes the family she never had.',
      aspects: A(62, 76, 92, 90, 62, 74, 84, 72, 84, 78, 40, 18),
      cover: { id: 8902659, c1: '#1d2b4a', c2: '#e0825a', ink: '#fdf3e1', accent: '#ffd37a', motif: 'planet', layout: 'band', font: 'sans' }
    },
    {
      id: 'a-psalm-for-the-wild-built', title: 'A Psalm for the Wild-Built', author: 'Becky Chambers', year: 2021, pages: 147,
      genres: ['Science fiction', 'Novella'], moods: ['cozy', 'quiet', 'hopeful', 'thoughtful'],
      rating: 4.5, ratingsK: 170, gem: true,
      tagline: 'A tea monk and a robot meet in the woods.',
      desc: 'Sibling Dex leaves city life to travel the countryside as a tea monk, serving comfort to small towns. Then a robot, long thought a myth, steps out of the woods and asks what people need.',
      aspects: A(50, 88, 86, 82, 44, 90, 84, 52, 82, 82, 40, 10),
      cover: { id: 10476616, c1: '#cfe0c3', c2: '#8fb48a', ink: '#1e2f1f', accent: '#fff8e3', motif: 'sprout', layout: 'frame', font: 'serif' }
    },
    {
      id: 'hamnet', title: 'Hamnet', author: "Maggie O'Farrell", year: 2020, pages: 305,
      genres: ['Historical fiction', 'Literary fiction'], moods: ['emotional', 'atmospheric'],
      rating: 4.5, ratingsK: 450,
      tagline: 'A family, a plague, and a play.',
      desc: 'In Elizabethan England, a quiet Warwickshire family is shaken by the sickness that takes their young son. A luminous imagining of the grief that may have shaped one of the most famous plays ever written.',
      aspects: A(70, 97, 92, 88, 46, 90, 70, 20, 98, 90, 52, 58),
      cover: { id: 10306590, c1: '#2a1214', c2: '#7a2a2a', ink: '#f5e6d0', accent: '#e9c690', motif: 'quill', layout: 'center', font: 'serif' }
    },
    {
      id: 'all-the-light-we-cannot-see', title: 'All the Light We Cannot See', author: 'Anthony Doerr', year: 2014, pages: 531,
      genres: ['Historical fiction'], moods: ['emotional', 'atmospheric', 'hopeful'],
      rating: 4.4, ratingsK: 1000,
      tagline: 'Two young lives on opposite sides of a war.',
      desc: 'A blind French girl and a gifted German boy move toward each other through occupied Europe. Radio waves, a hidden jewel and a city under bombardment connect their separate lives.',
      aspects: A(82, 96, 90, 90, 48, 90, 66, 24, 90, 88, 66, 62),
      cover: { id: 14559680, c1: '#0f2f4a', c2: '#3d82a6', ink: '#f4f1e4', accent: '#ffe08a', motif: 'stars', layout: 'frame', font: 'serif' }
    },
    {
      id: 'eleanor-oliphant-is-completely-fine', title: 'Eleanor Oliphant Is Completely Fine', author: 'Gail Honeyman', year: 2017, pages: 327,
      genres: ['Contemporary fiction', 'Humor'], moods: ['funny', 'emotional', 'hopeful'],
      rating: 4.4, ratingsK: 1000,
      tagline: 'Completely fine, thank you very much.',
      desc: 'Eleanor Oliphant likes her routines, her vodka on the weekend and her own company. One small act of kindness and one very ordinary man start to crack the careful life she has built.',
      aspects: A(74, 78, 94, 56, 66, 80, 80, 86, 90, 84, 34, 44),
      cover: { id: 8415055, c1: '#f4c95d', c2: '#ef9a6b', ink: '#3a1c12', accent: '#fff7e6', motif: 'dots', layout: 'frame', font: 'serif' }
    },
    {
      id: 'the-book-thief', title: 'The Book Thief', author: 'Markus Zusak', year: 2005, pages: 552,
      genres: ['Historical fiction', 'Young adult'], moods: ['emotional', 'atmospheric'],
      rating: 4.6, ratingsK: 2400,
      tagline: 'Death narrates a girl who steals books.',
      desc: 'In Nazi Germany, Liesel Meminger steals books and shares them with the neighbours sheltering in a basement. Narrated by Death, it is a story about words and the small mercies that survive a war.',
      aspects: A(78, 94, 92, 86, 44, 84, 72, 56, 98, 92, 52, 66),
      cover: { id: 8153054, c1: '#1b1b1d', c2: '#4a4a50', ink: '#f3efe6', accent: '#d8c27a', motif: 'books', layout: 'frame', font: 'serif' }
    },
    {
      id: 'normal-people', title: 'Normal People', author: 'Sally Rooney', year: 2018, pages: 266,
      genres: ['Contemporary fiction', 'Romance'], moods: ['emotional', 'quiet'],
      rating: 4.0, ratingsK: 1100,
      tagline: 'Two people, years of almost.',
      desc: 'Connell and Marianne grow up in the same small town in Ireland, one popular and one an outsider. Through school and university, their lives circle and collide in ways neither can quite say out loud.',
      aspects: A(56, 84, 92, 54, 52, 84, 90, 36, 86, 70, 40, 58),
      cover: { id: 8794265, c1: '#204b8a', c2: '#79a6d6', ink: '#fdfaf0', accent: '#fdfaf0', motif: 'rings', layout: 'top', font: 'sans' }
    },
    {
      id: 'a-little-life', title: 'A Little Life', author: 'Hanya Yanagihara', year: 2015, pages: 720,
      genres: ['Literary fiction', 'Contemporary fiction'], moods: ['emotional', 'dark'],
      rating: 4.4, ratingsK: 700,
      tagline: 'Four friends, one long and painful love.',
      desc: 'Four friends move to New York after college and build their lives together over decades. At the center is Jude, whose past shapes everything in an immersive, harrowing story about friendship and endurance.',
      aspects: A(66, 90, 96, 70, 36, 78, 74, 28, 98, 78, 56, 98),
      cover: { id: 12065783, c1: '#2a2a2e', c2: '#6b5a4a', ink: '#f1ece2', accent: '#e8d9b8', motif: 'towers', layout: 'bold', font: 'sans' }
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Users                                                               */
  /* ------------------------------------------------------------------ */
  var users = [
    { id: 'u_me',     name: 'Maya', handle: '@maya.reads', initials: 'M',  joined: 'March 2024', me: true },
    { id: 'u_priya',  name: 'Priya S.',  initials: 'PS', overlap: 91, shared: 14 },
    { id: 'u_tomas',  name: 'Tomas B.',  initials: 'TB', overlap: 88, shared: 11 },
    { id: 'u_june',   name: 'June W.',   initials: 'JW', overlap: 86, shared: 9 },
    { id: 'u_idris',  name: 'Idris K.',  initials: 'IK', overlap: 84, shared: 8 },
    { id: 'u_sana',   name: 'Sana A.',   initials: 'SA', overlap: 83, shared: 10 },
    { id: 'u_lena',   name: 'Lena M.',   initials: 'LM', overlap: 81, shared: 7 },
    { id: 'u_omar',   name: 'Omar H.',   initials: 'OH', overlap: 79, shared: 6 },
    { id: 'u_daniel', name: 'Daniel R.', initials: 'DR', overlap: 77, shared: 6 }
  ];

  /* ------------------------------------------------------------------ */
  /* Reader profile: how much the reader values each aspect (0-100).     */
  /* For dial aspects (pacing, complexity, darkness) it is the PREFERRED */
  /* level instead.                                                      */
  /* ------------------------------------------------------------------ */
  var readerProfile = {
    userId: 'u_me',
    archetype: 'The Heart-First Reader',
    summary: 'You follow people before plot. Give you a character to love and a world to get lost in, and you will forgive almost anything else.',
    aspects: {
      plot: 80, writing: 88, characters: 92, world: 84, pacing: 61, editing: 72,
      dialogue: 78, humor: 68, emotion: 91, ending: 82, complexity: 55, darkness: 42
    },
    loves: ['Character-driven stories', 'Immersive worlds', 'Lyrical writing', 'Emotional arcs'],
    avoids: ['Very slow pacing', 'Overly complex prose'],
    streakDays: 12,
    goal: { target: 24, label: 'Reading goal' },
    confidence: 87,
    signals: { ratings: 38, reviews: 14, shelved: 21 }
  };

  /* ------------------------------------------------------------------ */
  /* Precomputed collaborative + semantic signals for the demo reader.   */
  /* In production these come from LightGCN (collaborative) and MiniLM  */
  /* (semantic). The interpretable score is computed live from aspects.  */
  /* ------------------------------------------------------------------ */
  var recommendations = [
    { bookId: 'project-hail-mary',                  collaborative: 97, semantic: 94 },
    { bookId: 'a-man-called-ove',                   collaborative: 96, semantic: 93 },
    { bookId: 'the-seven-husbands-of-evelyn-hugo',  collaborative: 95, semantic: 92 },
    { bookId: 'the-midnight-library',               collaborative: 86, semantic: 84 },
    { bookId: 'the-silent-patient',                 collaborative: 78, semantic: 70 },
    { bookId: '1984',                               collaborative: 80, semantic: 74 },
    { bookId: 'atomic-habits',                      collaborative: 70, semantic: 62 },
    { bookId: 'the-alchemist',                      collaborative: 66, semantic: 66 },
    { bookId: 'norwegian-wood',                     collaborative: 82, semantic: 85 },
    { bookId: 'a-gentleman-in-moscow',              collaborative: 90, semantic: 90 },
    { bookId: 'the-song-of-achilles',               collaborative: 95, semantic: 97 },
    { bookId: 'klara-and-the-sun',                  collaborative: 94, semantic: 96 },
    { bookId: 'tomorrow-and-tomorrow-and-tomorrow', collaborative: 88, semantic: 89 },
    { bookId: 'circe',                              collaborative: 91, semantic: 91 },
    { bookId: 'pachinko',                           collaborative: 88, semantic: 90 },
    { bookId: 'anxious-people',                     collaborative: 90, semantic: 89 },
    { bookId: 'beartown',                           collaborative: 87, semantic: 88 },
    { bookId: 'daisy-jones-and-the-six',            collaborative: 86, semantic: 83 },
    { bookId: 'the-house-in-the-cerulean-sea',      collaborative: 84, semantic: 83 },
    { bookId: 'legends-and-lattes',                 collaborative: 80, semantic: 82 },
    { bookId: 'never-let-me-go',                    collaborative: 82, semantic: 86 },
    { bookId: 'piranesi',                           collaborative: 83, semantic: 86 },
    { bookId: 'station-eleven',                     collaborative: 84, semantic: 82 },
    { bookId: 'the-night-circus',                   collaborative: 78, semantic: 77 },
    { bookId: 'kafka-on-the-shore',                 collaborative: 68, semantic: 74 },
    { bookId: 'small-things-like-these',            collaborative: 80, semantic: 85 },
    { bookId: 'the-secret-history',                 collaborative: 70, semantic: 74 },
    { bookId: 'dune',                               collaborative: 62, semantic: 66 },
    { bookId: 'the-road',                           collaborative: 56, semantic: 62 },
    { bookId: 'the-martian',                        collaborative: 91, semantic: 88 },
    { bookId: 'convenience-store-woman',            collaborative: 76, semantic: 80 },
    { bookId: 'stoner',                             collaborative: 74, semantic: 82 },
    { bookId: 'the-long-way-to-a-small-angry-planet', collaborative: 84, semantic: 88 },
    { bookId: 'a-psalm-for-the-wild-built',         collaborative: 80, semantic: 86 },
    { bookId: 'hamnet',                             collaborative: 88, semantic: 91 },
    { bookId: 'all-the-light-we-cannot-see',        collaborative: 86, semantic: 87 },
    { bookId: 'eleanor-oliphant-is-completely-fine', collaborative: 88, semantic: 86 },
    { bookId: 'the-book-thief',                     collaborative: 90, semantic: 88 },
    { bookId: 'normal-people',                      collaborative: 74, semantic: 80 },
    { bookId: 'a-little-life',                      collaborative: 72, semantic: 78 }
  ];

  /* Item-item neighbours ("readers who loved X also loved Y"), best first. */
  var neighbors = {
    'project-hail-mary': ['the-song-of-achilles', 'tomorrow-and-tomorrow-and-tomorrow', 'the-martian', 'klara-and-the-sun', 'the-long-way-to-a-small-angry-planet', 'piranesi', 'station-eleven'],
    'a-man-called-ove': ['anxious-people', 'eleanor-oliphant-is-completely-fine', 'the-house-in-the-cerulean-sea', 'a-gentleman-in-moscow', 'small-things-like-these', 'legends-and-lattes', 'beartown'],
    'the-seven-husbands-of-evelyn-hugo': ['daisy-jones-and-the-six', 'circe', 'pachinko', 'hamnet', 'the-song-of-achilles', 'the-book-thief', 'tomorrow-and-tomorrow-and-tomorrow'],
    'the-midnight-library': ['the-house-in-the-cerulean-sea', 'klara-and-the-sun', 'a-psalm-for-the-wild-built', 'piranesi', 'station-eleven', 'legends-and-lattes'],
    'the-silent-patient': ['the-secret-history', 'the-road', 'a-little-life'],
    '1984': ['the-road', 'dune', 'station-eleven', 'never-let-me-go', 'all-the-light-we-cannot-see'],
    'the-alchemist': ['kafka-on-the-shore', 'the-night-circus', 'piranesi']
  };

  /* ------------------------------------------------------------------ */
  /* Reviews. The reader's own reviews come first (user 'u_me').         */
  /* The engine reads aspect sentiment out of the text (see lexicon).    */
  /* ------------------------------------------------------------------ */
  var reviews = [
    { id: 'r-me-phm', bookId: 'project-hail-mary', user: 'u_me', rating: 5, daysAgo: 3,
      text: 'Rocky might be the most lovable character I have read in years. The science felt like a puzzle I was solving with him, and the friendship at the heart of the story hit me harder than I expected. That ending left me in tears.' },
    { id: 'r-me-ove', bookId: 'a-man-called-ove', user: 'u_me', rating: 5, daysAgo: 21,
      text: 'Funny and heartbreaking in the same paragraph. Ove is grumpy, stubborn and impossible to forget, and watching his neighbours wear him down is wonderful. I cried on the bus.' },
    { id: 'r-me-hugo', bookId: 'the-seven-husbands-of-evelyn-hugo', user: 'u_me', rating: 5, daysAgo: 38,
      text: 'Glamorous, messy and deeply human. The characters felt real even at their worst, and the dialogue crackles. The ending destroyed me.' },
    { id: 'r-me-ml', bookId: 'the-midnight-library', user: 'u_me', rating: 4, daysAgo: 52,
      text: 'A lovely idea with a hopeful message. The prose is simple, though, and the middle felt a little repetitive.' },
    { id: 'r-me-sp', bookId: 'the-silent-patient', user: 'u_me', rating: 3.5, daysAgo: 77,
      text: 'Gripping plot and a twist I did not see coming, but the characters felt thin and the writing was plain.' },
    { id: 'r-me-1984', bookId: '1984', user: 'u_me', rating: 4, daysAgo: 104,
      text: 'Bleak and brilliant. The world building is chilling, but it is a heavy read and the pacing sags in the middle.' },
    { id: 'r-me-ah', bookId: 'atomic-habits', user: 'u_me', rating: 3, daysAgo: 131,
      text: 'Useful and clearly edited, though it repeats itself. Not much emotional pull for me.' },
    { id: 'r-me-alc', bookId: 'the-alchemist', user: 'u_me', rating: 3, daysAgo: 170,
      text: 'A pleasant fable, but the characters are thin and the message felt too simple.' },

    { id: 'r-priya-phm', bookId: 'project-hail-mary', user: 'u_priya', rating: 5, daysAgo: 40,
      text: 'Funny, tense and weirdly tender. The humor never gets in the way of the stakes, and the plot keeps surprising you.' },
    { id: 'r-tomas-phm', bookId: 'project-hail-mary', user: 'u_tomas', rating: 4.5, daysAgo: 66,
      text: 'The world building is wonderful and the pacing is relentless. I wanted a little more depth from the supporting cast.' },
    { id: 'r-june-soa', bookId: 'the-song-of-achilles', user: 'u_june', rating: 5, daysAgo: 12,
      text: 'The prose is beautiful from the first page, and the relationship at the center is so tender that the ending broke me. A little slow in the middle, but I never wanted to stop.' },
    { id: 'r-idris-soa', bookId: 'the-song-of-achilles', user: 'u_idris', rating: 4.5, daysAgo: 90,
      text: 'Lyrical writing and deep characters. The pacing is measured, so give it time.' },
    { id: 'r-sana-klara', bookId: 'klara-and-the-sun', user: 'u_sana', rating: 4.5, daysAgo: 25,
      text: 'Quiet, strange and moving. The writing is gorgeous, though the pacing is slow and some readers will want more plot.' },
    { id: 'r-lena-klara', bookId: 'klara-and-the-sun', user: 'u_lena', rating: 4, daysAgo: 71,
      text: 'A gentle book with a lot of heart. Klara is a wonderful narrator and the ending stayed with me.' },
    { id: 'r-priya-tomorrow', bookId: 'tomorrow-and-tomorrow-and-tomorrow', user: 'u_priya', rating: 5, daysAgo: 18,
      text: 'The friendship at the center is the best I have read in years. Sharp dialogue, funny in places and devastating in others.' },
    { id: 'r-omar-tomorrow', bookId: 'tomorrow-and-tomorrow-and-tomorrow', user: 'u_omar', rating: 4.5, daysAgo: 55,
      text: 'Emotional and clever. The game design details never feel heavy, and the characters are unforgettable.' },
    { id: 'r-tomas-piranesi', bookId: 'piranesi', user: 'u_tomas', rating: 5, daysAgo: 30,
      text: 'The world building is extraordinary and the writing is hypnotic. Short, strange and perfectly edited.' },
    { id: 'r-june-piranesi', bookId: 'piranesi', user: 'u_june', rating: 4, daysAgo: 80,
      text: 'Atmospheric and beautifully written. The characters are sparse, which suits the story, and the ending is satisfying.' },
    { id: 'r-sana-circe', bookId: 'circe', user: 'u_sana', rating: 5, daysAgo: 45,
      text: 'The prose is gorgeous and Circe is a wonderful character. The pacing is slow in places, but the world is so vivid that I kept reading.' },
    { id: 'r-idris-circe', bookId: 'circe', user: 'u_idris', rating: 4.5, daysAgo: 100,
      text: 'Lyrical, patient and emotional. A beautiful retelling.' },
    { id: 'r-priya-anxious', bookId: 'anxious-people', user: 'u_priya', rating: 4.5, daysAgo: 22,
      text: 'Hilarious and moving. The dialogue is sharp and the characters feel like people you know.' },
    { id: 'r-lena-nlmg', bookId: 'never-let-me-go', user: 'u_lena', rating: 4, daysAgo: 120,
      text: 'Quiet, haunting and heartbreaking. The pacing is slow, but the writing is superb and the ending hurts.' },
    { id: 'r-daniel-martian', bookId: 'the-martian', user: 'u_daniel', rating: 5, daysAgo: 15,
      text: 'So funny and so tense. The plot is a puzzle with a great voice, though the characters are lighter than in Project Hail Mary.' },
    { id: 'r-omar-dune', bookId: 'dune', user: 'u_omar', rating: 4.5, daysAgo: 95,
      text: 'The world building is unmatched. It is dense and complex, and the pacing is slow at first, but it rewards patience.' },
    { id: 'r-tomas-se', bookId: 'station-eleven', user: 'u_tomas', rating: 4, daysAgo: 60,
      text: 'Beautifully written and haunting. The structure is layered, and the ending is quietly hopeful.' },
    { id: 'r-sana-small', bookId: 'small-things-like-these', user: 'u_sana', rating: 4, daysAgo: 35,
      text: 'Tiny and perfect. The writing is spare, the editing is flawless, and the emotional weight is huge.' },
    { id: 'r-june-pachinko', bookId: 'pachinko', user: 'u_june', rating: 5, daysAgo: 48,
      text: 'Sweeping and deeply moving. The characters stay with you, and the world feels real. The pacing is slow, but it is worth it.' },
    { id: 'r-lena-gentleman', bookId: 'a-gentleman-in-moscow', user: 'u_lena', rating: 5, daysAgo: 33,
      text: 'Charming, witty and warm. The prose is a joy and the characters are wonderful.' },
    { id: 'r-idris-legends', bookId: 'legends-and-lattes', user: 'u_idris', rating: 4.5, daysAgo: 19,
      text: 'The coziest book I have read in ages. Light, funny and heartwarming, with characters I wanted to keep.' },
    { id: 'r-daniel-road', bookId: 'the-road', user: 'u_daniel', rating: 4, daysAgo: 140,
      text: 'Bleak and beautiful. The prose is spare and the tone is relentlessly dark, so it is not an easy read.' }
  ];

  /* The example review from the project presentation. */
  var sampleReview = 'The prose is beautiful from the first page, and the characters are deep enough that I felt like I knew them by the end. The pacing is slow through the middle third, but the world building is so immersive that I kept reading anyway.';

  /* Mock aspect-sentiment lexicon used by engine.analyzeReview(). */
  var lexicon = {
    aspects: {
      plot:       ['plot', 'twist', 'twists', 'storyline', 'suspense', 'mystery', 'structure', 'stakes', 'puzzle'],
      writing:    ['prose', 'writing', 'written', 'lyrical', 'sentences', 'language', 'voice', 'style', 'poetic'],
      characters: ['character', 'characters', 'protagonist', 'cast', 'relationship', 'relationships', 'friendship', 'bond', 'narrator'],
      world:      ['world', 'worldbuilding', 'setting', 'atmosphere', 'universe', 'immersive', 'landscape', 'atmospheric'],
      pacing:     ['pacing', 'pace', 'paced', 'slow', 'fast', 'dragged', 'drags', 'rushed', 'sags', 'relentless', 'momentum', 'measured'],
      editing:    ['editing', 'edited', 'bloated', 'padded', 'typos', 'repetitive', 'repeats', 'tight'],
      dialogue:   ['dialogue', 'banter', 'conversations'],
      humor:      ['funny', 'humor', 'humour', 'laugh', 'laughed', 'witty', 'hilarious', 'jokes'],
      emotion:    ['cried', 'cry', 'tears', 'heartbreaking', 'emotional', 'moving', 'devastating', 'touching', 'gutting', 'heartwarming', 'tender'],
      ending:     ['ending', 'finale', 'conclusion', 'epilogue'],
      complexity: ['complex', 'dense', 'confusing', 'layered', 'difficult', 'intricate'],
      darkness:   ['dark', 'bleak', 'grim', 'disturbing', 'violent', 'gritty', 'heavy', 'chilling', 'cozy', 'cosy']
    },
    positive: ['beautiful', 'beautifully', 'brilliant', 'wonderful', 'amazing', 'love', 'loved', 'lovely', 'lovable', 'perfect', 'stunning', 'gorgeous',
               'great', 'excellent', 'favorite', 'favourite', 'best', 'charming', 'gripping', 'immersive', 'deep', 'tender', 'heartwarming',
               'unforgettable', 'sharp', 'clever', 'compelling', 'rich', 'memorable', 'superb', 'lyrical', 'hilarious', 'funny', 'witty',
               'flawless', 'extraordinary', 'hypnotic', 'satisfying', 'vivid', 'patient', 'joy', 'worth', 'crackles', 'hopeful', 'useful',
               'clearly', 'tiny', 'sweeping', 'warm', 'lightest', 'coziest', 'cozy', 'cosy'],
    negative: ['slow', 'boring', 'dragged', 'drags', 'dull', 'confusing', 'predictable', 'flat', 'thin', 'weak', 'bland', 'rushed', 'tedious',
               'repetitive', 'repeats', 'bloated', 'overlong', 'disappointing', 'meh', 'sags', 'stiff', 'clunky', 'plain', 'shallow',
               'forgettable', 'messy', 'dense', 'heavy', 'sparse', 'lighter', 'simple']
  };

  /* ------------------------------------------------------------------ */
  /* Seed shelf for the demo reader. Days are relative to first load.    */
  /* ------------------------------------------------------------------ */
  var seedShelf = {
    'project-hail-mary':                 { status: 'read', rating: 5, startedDaysAgo: 14, finishedDaysAgo: 3 },
    'a-man-called-ove':                  { status: 'read', rating: 5, startedDaysAgo: 30, finishedDaysAgo: 21 },
    'the-seven-husbands-of-evelyn-hugo': { status: 'read', rating: 5, startedDaysAgo: 45, finishedDaysAgo: 38 },
    'the-midnight-library':              { status: 'read', rating: 4, startedDaysAgo: 60, finishedDaysAgo: 52 },
    'the-silent-patient':                { status: 'read', rating: 3.5, startedDaysAgo: 84, finishedDaysAgo: 77 },
    '1984':                              { status: 'read', rating: 4, startedDaysAgo: 118, finishedDaysAgo: 104 },
    'atomic-habits':                     { status: 'read', rating: 3, startedDaysAgo: 140, finishedDaysAgo: 131 },
    'the-alchemist':                     { status: 'read', rating: 3, startedDaysAgo: 175, finishedDaysAgo: 170 },
    'norwegian-wood':                    { status: 'reading', progress: 82, startedDaysAgo: 9 },
    'a-gentleman-in-moscow':             { status: 'reading', progress: 37, startedDaysAgo: 5 },
    'the-night-circus':                  { status: 'want', addedDaysAgo: 12 },
    'piranesi':                          { status: 'want', addedDaysAgo: 8 },
    'station-eleven':                    { status: 'want', addedDaysAgo: 30 },
    'the-martian':                       { status: 'want', addedDaysAgo: 2 }
  };

  var seedActivity = [
    { type: 'finished', bookId: 'project-hail-mary',                 daysAgo: 3,  text: 'Finished Project Hail Mary and rated it 5.0' },
    { type: 'dna',                                                  daysAgo: 3,  text: 'LitSense refreshed your Reader DNA: Characters +1' },
    { type: 'want',     bookId: 'the-martian',                       daysAgo: 2,  text: 'Added The Martian to Want to Read' },
    { type: 'started',  bookId: 'a-gentleman-in-moscow',             daysAgo: 5,  text: 'Started A Gentleman in Moscow' },
    { type: 'review',   bookId: 'a-man-called-ove',                  daysAgo: 21, text: 'Reviewed A Man Called Ove' }
  ];

  /* ------------------------------------------------------------------ */
  /* Filters for the Recommendations page                                */
  /* ------------------------------------------------------------------ */
  var genreFilters = [
    { id: 'literary',   label: 'Literary fiction',   genres: ['Literary fiction', 'Classic'] },
    { id: 'scifi',      label: 'Science fiction',    genres: ['Science fiction', 'Dystopian', 'Post-apocalyptic'] },
    { id: 'fantasy',    label: 'Fantasy',            genres: ['Fantasy', 'Cozy fantasy', 'Magical realism', 'Mythology', 'Historical fantasy'] },
    { id: 'historical', label: 'Historical',         genres: ['Historical fiction', 'Family saga'] },
    { id: 'contemporary', label: 'Contemporary',     genres: ['Contemporary fiction', 'Humor', 'Music', 'Sports'] },
    { id: 'mystery',    label: 'Mystery and thriller', genres: ['Thriller', 'Mystery', 'Dark academia'] }
  ];

  var moodFilters = [
    { id: 'cozy',        label: 'Cozy' },
    { id: 'emotional',   label: 'Emotional' },
    { id: 'funny',       label: 'Funny' },
    { id: 'atmospheric', label: 'Atmospheric' },
    { id: 'dark',        label: 'Dark' },
    { id: 'hopeful',     label: 'Hopeful' }
  ];

  var demos = [
    { id: 1, key: 'dark',      name: 'Dark Literary',   short: 'Dark' },
    { id: 2, key: 'editorial', name: 'Warm Editorial',  short: 'Editorial' },
    { id: 3, key: 'os',        name: 'Reader OS',       short: 'OS' }
  ];

  LS.data = {
    config: config,
    aspects: aspects,
    aspectCopy: aspectCopy,
    books: books,
    users: users,
    readerProfile: readerProfile,
    recommendations: recommendations,
    neighbors: neighbors,
    reviews: reviews,
    sampleReview: sampleReview,
    lexicon: lexicon,
    seedShelf: seedShelf,
    seedActivity: seedActivity,
    genreFilters: genreFilters,
    moodFilters: moodFilters,
    demos: demos
  };
})(window);
