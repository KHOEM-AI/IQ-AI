# IQ-AI Sound Taxonomy
Version: 1.0
Status: Initial master specification

## Purpose

Define the sound categories, subcategories, metadata, and quality
requirements for the IQ-AI sound library.

Important:
- A sound type is not the same as an audio file.
- Multiple recordings may represent one sound type.
- Synthetic and real recordings must be identified separately.
- Planned sounds must not be reported as existing assets.
- Every asset must have a valid source and usage license.

## 01. Human Voice and Speech

- Conversation and dialogue
- Greetings, questions, answers, and short commands
- Narration and storytelling
- Whispering, shouting, calling, and speaking softly
- Laughing, crying, sobbing, and chuckling
- Coughing, sneezing, yawning, and breathing
- Humming, singing, and vocal exercises
- Male, female, child, and age-appropriate voice categories
- Different speaking rates, pitches, accents, and vocal styles
- Emotions: neutral, happy, sad, surprised, worried, excited
- Khmer speech and other supported languages
- Phonemes, syllables, words, sentences, and conversational turns

Target: 100+ distinct human-voice sound types, with counts tracked
separately for recordings, speakers, languages, and variations.

## 02. Animals

- Domestic animals: dogs, cats, cattle, pigs, goats, horses
- Poultry: chickens, ducks, geese
- Wild mammals: elephants, deer, monkeys, big cats
- Birds: calls, chirps, songs, wings
- Amphibians and reptiles
- Insects: crickets, cicadas, bees, mosquitoes
- Aquatic animals: frogs, fish, dolphins, whales
- Feeding, movement, warning calls, and group sounds

## 03. Music and Musical Instruments

- Piano, keyboard, guitar, bass, drums, percussion
- Traditional Khmer instruments
- Wind, string, and orchestral instruments
- Individual notes and scales
- Rhythms, beats, musical phrases
- Acoustic and electronic music
- Tuning, practice, performance, and audience sounds

Record copyright and licensing information for music assets.

## 04. Nature, Weather, and Water

- Light rain, heavy rain, drizzle, and rainfall on surfaces
- Thunder, lightning-associated thunder, storms, strong wind
- Ocean waves, surf, tides, and water hitting the shore
- Rivers, streams, waterfalls, and flowing water
- Water dripping, splashing, pouring, bubbling, boiling
- Ice, snow, and other climate-related sounds
- Forests, leaves, grass, and natural ambience
- Day and night environments

## 05. Road Vehicles and Traffic

- Cars, motorcycles, buses, trucks, bicycles
- Engines starting, idling, accelerating, and stopping
- Horns, indicators, brakes, tires, and doors
- Passing vehicles and traffic ambience
- Electric vehicles and charging-related sounds
- Road construction and vehicle maintenance

## 06. Aircraft, Rail, and Water Transport

- Passenger and cargo aircraft
- Helicopters and small aircraft
- Takeoff, landing, cabin, and airport ambience
- Trains, locomotives, rail crossings, and stations
- Boats, ships, ferries, and marine engines
- Port, harbor, and transport terminal ambience

## 07. Factories, Machines, and Tools

- Fans, pumps, motors, compressors
- Generators and power equipment
- Production lines and industrial ambience
- Drilling, sawing, grinding, cutting, and sanding
- Hand tools and power tools
- Printing, packaging, and assembly machinery
- Startup, shutdown, idle, fault, and warning states

## 08. Military and Weapon-Related Sounds

- Distant and contextual recordings of military vehicles
- Tank and armored vehicle movement
- Aircraft and military transport ambience
- Historical and documentary sound effects
- Distant gunfire and artillery ambience
- Explosions represented as licensed recordings or clearly labeled
  synthetic effects
- Alerts, evacuation signals, and aftermath ambience

Use for education, documentation, accessibility, and media production.
Do not include instructions for constructing, operating, or optimizing
weapons or explosives.

## 09. Natural Disasters and Emergencies

- Earthquake and structural movement ambience
- Floods, fast-moving water, and landslides
- Storms, hurricanes, and extreme wind
- Wildfire ambience and crackling fire
- Avalanches and falling debris
- Emergency sirens and public warning signals
- Clearly distinguish real recordings from simulations.

## 10. Objects, Doors, and Everyday Actions

- Doors opening, closing, creaking, and slamming
- Knocking, locks, keys, handles, and latches
- Glass, ceramic, wood, metal, and plastic objects
- Objects falling, rolling, bouncing, and colliding
- Paper tearing, folding, crumpling, and cutting
- Footsteps on different surfaces
- Furniture, household items, and kitchen tools
- Rubbing, scraping, tapping, and handling materials

## 11. Electronics, Computers, and UI Sounds

- Keyboard, mouse, touchscreen, and button sounds
- Phone calls, messages, notifications, and alarms
- Computer startup, shutdown, and system events
- Success, failure, loading, selection, and navigation
- Network connection and disconnection
- Device vibration and electronic interference
- Accessible alerts with distinguishable patterns

## 12. Places and Environmental Ambience

- Markets, shops, restaurants, and food stalls
- Schools, classrooms, libraries, and campuses
- Hospitals and healthcare environments
- Offices and meeting rooms
- Factories, workshops, and warehouses
- Streets, parks, stadiums, and public transport
- Homes, kitchens, gardens, and courtyards
- Airports, stations, ports, and public buildings

## 13. Synthetic, Game, and Cinematic Effects

- Science-fiction and futuristic effects
- Game start, success, failure, and item selection
- Magical, fantasy, and transition effects
- Short stingers and cinematic ambience
- Abstract tones, sweeps, pulses, and textures
- Robot and artificial voice effects
- Clearly identify generated or synthesized audio.

## 14. Movement, Contact, and Physical Actions

- Walking, running, jumping, and footsteps
- Cloth, fabric, and equipment movement
- Objects rubbing, scraping, striking, and colliding
- Fire crackling and materials rustling
- Sports, exercise, and recreation
- Repeated actions and changes in intensity

## 15. Health, Safety, and Rescue

- Medical equipment and monitor alarms
- Ambulance and emergency-service sirens
- Fire alarms and evacuation warnings
- Public-address announcements
- Safety alerts and device fault signals
- Training and simulation environments

Medical and emergency sounds must not be presented as a substitute
for real emergency alerts or professional medical assessment.

## Required Metadata

Every audio asset should contain:

- id: stable unique identifier
- name_km: Khmer display name
- name_en: English display name
- category: primary category
- subcategory: specific sound type
- description: what the sound represents
- tags: searchable keywords in supported languages
- source_type: real_recording, licensed_recording, or synthetic
- source: provenance or generation method
- license: usage rights
- mime: media MIME type
- format: file format
- size: file size in bytes
- duration_ms: audio duration
- sample_rate_hz: sample rate, when available
- channels: mono or stereo, when available
- language: speech language, if applicable
- transcript: spoken words, if applicable
- speaker_id: optional pseudonymous speaker identifier
- emotion: optional vocal emotion label
- quality_status: pending, passed, or rejected
- created_at: creation timestamp

Do not invent missing metadata. Unknown values should be null or omitted.

## Quality and Integrity Requirements

1. Every metadata record must reference an existing audio file.
2. Every audio file must have valid metadata.
3. Audio format and MIME type must match the actual content.
4. Test that files can be decoded and played.
5. Record duration, sample rate, channels, and file size when possible.
6. Detect duplicate files and near-duplicate recordings.
7. Verify licensing and source attribution before publication.
8. Separate real recordings from synthetic sounds.
9. Support search by Khmer name, English name, tags, and category.
10. Keep backups before migrations or bulk updates.

## Progress Tracking

Existing library snapshot: 30 metadata records across 10 categories.
This is a snapshot from the initial audit, not a permanent count.

Track these separately:
- planned sound types
- implemented sound types
- actual audio files
- verified playable files
- licensed and publishable files
- duplicate or rejected files

Do not mark a planned sound as completed until its asset and metadata
have been checked.

## Next Milestones

1. Audit the existing 30 assets and verify their playback.
2. Expand the category and subcategory registry.
3. Add metadata validation and duplicate detection.
4. Build a prioritized sound inventory.
5. Acquire or generate assets with appropriate rights.
6. Test listing, playback, download, and UI integration.
