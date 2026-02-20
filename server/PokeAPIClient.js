const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const CACHE_DIR = path.join(__dirname, 'cache');
class PokeAPIClient {
    constructor(language = 'fr') {
        this.language = language;
        this.baseUrl = 'https://pokeapi.co/api/v2';
        this.cache = {
            pokemon: {},
            moves: {},
            types: {}
        };
        this.loadCacheFromDisk();
    }

    getCacheFilePath(type) {
        return path.join(CACHE_DIR, `${type}_${this.language}.json`);
    }

    loadCacheFromDisk() {
        try {
            // Load Pokemon cache
            const pokemonCachePath = this.getCacheFilePath('pokemon');
            if (fs.existsSync(pokemonCachePath)) {
                this.cache.pokemon = fs.readJsonSync(pokemonCachePath);
                console.log(`Loaded ${Object.keys(this.cache.pokemon).length} Pokemon from cache`);
            }

            // Load Moves cache
            const movesCachePath = this.getCacheFilePath('moves');
            if (fs.existsSync(movesCachePath)) {
                this.cache.moves = fs.readJsonSync(movesCachePath);
                console.log(`Loaded ${Object.keys(this.cache.moves).length} moves from cache`);
            }

            // Load Types cache
            const typesCachePath = this.getCacheFilePath('types');
            if (fs.existsSync(typesCachePath)) {
                const typesCache = fs.readJsonSync(typesCachePath);
                
                // Check if we have the old format (string values) or new format (object values with id)
                const firstKey = Object.keys(typesCache)[0];
                const isOldFormat = firstKey && typeof typesCache[firstKey] === 'string';
                
                if (isOldFormat) {
                    console.log('Detected old types cache format, cache will be rebuilt');
                    // We'll let fetchTypesList rebuild the cache
                    this.cache.types = {};
                } else {
                    this.cache.types = typesCache;
                    console.log(`Loaded ${Object.keys(this.cache.types).length} types from cache`);
                }
            }
        } catch (error) {
            console.error('Error loading cache:', error.message);
        }
    }

    saveCacheToDisk() {
        try {
            fs.writeJsonSync(this.getCacheFilePath('pokemon'), this.cache.pokemon);
            fs.writeJsonSync(this.getCacheFilePath('moves'), this.cache.moves);
            fs.writeJsonSync(this.getCacheFilePath('types'), this.cache.types);
            console.log('Cache saved to disk');
        } catch (error) {
            console.error('Error saving cache:', error.message);
        }
    }

    async fetchPokemonList() {
        if (Object.keys(this.cache.pokemon).length > 0) {
            return Object.values(this.cache.pokemon);
        }

        try {
            
            const response = await axios.get(`${this.baseUrl}/pokemon?limit=251`);
            const pokemonList = response.data.results;

            // Fetch detailed data for each Pokemon
            for (let i = 0; i < pokemonList.length; i++) {
                const pokemon = pokemonList[i];
                const id = i + 1;

                // Skip id 0 (we'll add an empty entry later)
                if (id === 0) continue;

                // Check if already in cache
                if (this.cache.pokemon[id]) continue;

                console.log(`Fetching data for Pokemon #${id}: ${pokemon.name}`);

                const pokemonData = await axios.get(pokemon.url);
                const speciesData = await axios.get(pokemonData.data.species.url);

                // Find the name in the specified language
                let name = pokemon.name;
                const nameEntry = speciesData.data.names.find(
                    n => n.language.name === this.language
                );
                if (nameEntry) {
                    name = nameEntry.name;
                }

                // Extract the types
                const types = pokemonData.data.types.map(t => t.type.name);

                // Store in cache
                this.cache.pokemon[id] = {
                    id,
                    name,
                    types
                };
            }

            // Add special entries for Substitute and Pikachu (Yellow)
            this.cache.pokemon[152] = { id: 152, name: "Substitute", types: ["normal"] };
            this.cache.pokemon[153] = { id: 153, name: "Pikachu (Yellow)", types: ["electric"] };

            // Add empty entry for ID 0
            this.cache.pokemon[0] = { id: 0, name: "", types: [] };

            // Save to disk
            this.saveCacheToDisk();

            return Object.values(this.cache.pokemon);
        } catch (error) {
            console.error('Error fetching Pokemon list:', error.message);
            return [];
        }
    }

    async fetchMovesList() {
        if (Object.keys(this.cache.moves).length > 0) {
            return Object.values(this.cache.moves);
        }

        try {
            // Fetch all moves
            const response = await axios.get(`${this.baseUrl}/move?limit=300`);
            const movesList = response.data.results;

            // Fetch detailed data for each move
            for (let i = 0; i < movesList.length; i++) {
                const move = movesList[i];
                const id = i + 1;

                // Skip id 0 (we'll add an empty entry later)
                if (id === 0) continue;

                // Check if already in cache
                if (this.cache.moves[id]) continue;

                console.log(`Fetching data for Move #${id}: ${move.name}`);

                const moveData = await axios.get(move.url);

                // Find the name in the specified language
                let name = move.name;
                const nameEntry = moveData.data.names.find(
                    n => n.language.name === this.language
                );
                if (nameEntry) {
                    name = nameEntry.name;
                }

                // Store in cache
                this.cache.moves[id] = {
                    id,
                    name,
                    effect: moveData.data.effect_entries[0]?.short_effect || ""
                };
            }

            // Add empty entry for ID 0
            this.cache.moves[0] = { id: 0, name: "", effect: "" };

            // Save to disk
            this.saveCacheToDisk();

            return Object.values(this.cache.moves);
        } catch (error) {
            console.error('Error fetching moves list:', error.message);
            return [];
        }
    }

    async fetchTypesList() {
        if (Object.keys(this.cache.types).length > 0) {
            return this.cache.types;
        }

        try {
            // Fetch all types
            const response = await axios.get(`${this.baseUrl}/type`);
            const typesList = response.data.results;

            // Fetch detailed data for each type
            for (const type of typesList) {
                console.log(`Fetching data for Type: ${type.name}`);

                const typeData = await axios.get(type.url);

                // Find the name in the specified language
                let name = type.name;
                const nameEntry = typeData.data.names.find(
                    n => n.language.name === this.language
                );
                if (nameEntry) {
                    name = nameEntry.name;
                }

                // Extract the type ID from the API response
                const typeId = typeData.data.id;

                // Store in cache using ID as key
                this.cache.types[typeId] = {
                    id: typeId,
                    name: name,
                    slug: type.name  // Keep the original name/slug for reference
                };
            }

            // Save to disk
            this.saveCacheToDisk();

            return this.cache.types;
        } catch (error) {
            console.error('Error fetching types list:', error.message);
            return {};
        }
    }

    getPokemonName(id) {
        if (id in this.cache.pokemon) {
            return this.cache.pokemon[id].name;
        }
        return "Pokémon #" + id;
    }

    getMoveName(moveId) {
        if (moveId in this.cache.moves) {
            return this.cache.moves[moveId].name;
        }
        return "Attaque #" + moveId;
    }

    getMoveEffectName(effectId) {
        // This is still hardcoded as it's specific to the game mechanics
        // and not directly mappable to PokeAPI data
        const moveEffectNames = {
            0x00: this.language === 'fr' ? "Dégâts normaux" : "Normal Damage",
            0x01: this.language === 'fr' ? "Sommeil (sans dégâts, Inutilisé)" : "Sleep (no damage, Unused)",
            0x02: this.language === 'fr' ? "30% chance d'empoisonnement" : "30% Poison chance",
            0x03: this.language === 'fr' ? "Absorbe la moitié des dégâts" : "Absorb half damage",
            0x04: this.language === 'fr' ? "10% chance de brûlure" : "10% Burn chance",
            0x05: this.language === 'fr' ? "10% chance de gel" : "10% Freeze chance",
            0x06: this.language === 'fr' ? "10% chance de paralysie" : "10% Paralysis chance",
            0x07: this.language === 'fr' ? "Explosion / Auto-KO réduisant Déf" : "Explosion / Self-KO halving Def",
            0x08: this.language === 'fr' ? "Dévorêve" : "Dream Eater",
            0x09: this.language === 'fr' ? "Mimique" : "Mirror Move",
            0x0A: this.language === 'fr' ? "Augmente Attaque +1" : "Raise Attack +1",
            0x0B: this.language === 'fr' ? "Augmente Défense +1" : "Raise Defense +1",
            0x0C: this.language === 'fr' ? "Augmente Vitesse +1 (Inutilisé)" : "Raise Speed +1 (Unused)",
            0x0D: this.language === 'fr' ? "Augmente Spécial +1" : "Raise Special +1",
            0x0E: this.language === 'fr' ? "Augmente Précision +1 (Inutilisé)" : "Raise Accuracy +1 (Unused)",
            0x0F: this.language === 'fr' ? "Augmente Esquive +1" : "Raise Evasion +1",
            0x10: this.language === 'fr' ? "Gagne de l'argent (Jackpot)" : "Gain money (Pay Day)",
            0x11: this.language === 'fr' ? "Ne rate jamais" : "Never misses",
            0x12: this.language === 'fr' ? "Baisse Attaque -1 (chance)" : "Lower Attack -1 (chance)",
            0x13: this.language === 'fr' ? "Baisse Défense -1 (chance)" : "Lower Defense -1 (chance)",
            0x14: this.language === 'fr' ? "Baisse Vitesse -1 (chance)" : "Lower Speed -1 (chance)",
            0x15: this.language === 'fr' ? "Baisse Spécial -1 (chance, Inutilisé)" : "Lower Special -1 (chance, Unused)",
            0x16: this.language === 'fr' ? "Baisse Précision -1 (chance)" : "Lower Accuracy -1 (chance)",
            0x17: this.language === 'fr' ? "Baisse Esquive -1 (chance, Inutilisé)" : "Lower Evasion -1 (chance, Unused)",
            0x18: this.language === 'fr' ? "Change le type de l'utilisateur" : "Change user's type to match target",
            0x19: this.language === 'fr' ? "Réinitialise stats & statut" : "Reset stats & status to normal",
            0x1A: this.language === 'fr' ? "Ultralaser" : "Bide",
            0x1B: this.language === 'fr' ? "Mania / Danse-Fleur (2-3 tours, confusion après)" : "Thrash / Petal Dance (2-3 turns, confusion after)",
            0x1D: this.language === 'fr' ? "Frappe 2-5 fois" : "Hits 2-5 times",
            0x1F: this.language === 'fr' ? "10% chance d'apeurer" : "10% Flinch chance",
            0x20: this.language === 'fr' ? "Sommeil (1-3 tours)" : "Sleep (1-3 turns)",
            0x21: this.language === 'fr' ? "40% chance d'empoisonnement" : "40% Poison chance",
            0x22: this.language === 'fr' ? "30% chance de brûlure" : "30% Burn chance",
            0x23: this.language === 'fr' ? "10% chance de gel (Blizzard)" : "10% Freeze chance (Blizzard)",
            0x24: this.language === 'fr' ? "30% chance de paralysie" : "30% Paralysis chance",
            0x25: this.language === 'fr' ? "30% chance d'apeurer" : "30% Flinch chance",
            0x26: this.language === 'fr' ? "KO en un coup" : "OHKO",
            0x27: this.language === 'fr' ? "Tour de charge (ex: Lance-Soleil)" : "Charge turn (ex: Solar Beam, Sky Attack)",
            0x28: this.language === 'fr' ? "Dégâts de moitié PV, utilisateur à 1 PV" : "Half HP damage, leaves user at 1 HP",
            0x29: this.language === 'fr' ? "Dégâts fixes (Frappe Atlas, Draco-Rage...)" : "Fixed damage (Seismic Toss, Dragon Rage...)",
            0x2A: this.language === 'fr' ? "Attaques ligotantes (Ligotage/Étreinte) 2-5 tours" : "Binding moves (Wrap/Bind) 2-5 hits/traps",
            0x2B: this.language === 'fr' ? "Semi-invuln. premier tour (ex: Tunnel/Vol)" : "Semi-invuln first turn (ex: Dig/Fly)",
            0x2C: this.language === 'fr' ? "Double frappe (ex: Double-Pied)" : "Double hit (ex: Double Kick)",
            0x2D: this.language === 'fr' ? "Dégâts de recul si raté (ex: Pied Voltige)" : "Crash damage if miss (ex: High Jump Kick)",
            0x2F: this.language === 'fr' ? "Augmente taux de critique" : "Increases crit rate",
            0x30: this.language === 'fr' ? "Recul 1/4 (ex: Damoclès)" : "Recoil 1/4 (ex: Double-Edge)",
            0x33: this.language === 'fr' ? "Augmente Défense +2" : "Raise Defense +2",
            0x3F: this.language === 'fr' ? "Baisse Esquive -2 (chance, Inutilisé)" : "Lower Evasion -2 (chance, Unused)",
            0x40: this.language === 'fr' ? "Double Spécial en défense" : "Double Special on defense",
            0x41: this.language === 'fr' ? "Double Défense en défense" : "Double Defense on defense",
            0x4F: this.language === 'fr' ? "Crée un Clone" : "Create Substitute",
            0x50: this.language === 'fr' ? "Ne peut pas attaquer au tour suivant" : "Cannot attack next turn",
            0x54: this.language === 'fr' ? "Trempette (sans effet)" : "Splash (no effect)",
            0x56: this.language === 'fr' ? "Entrave" : "Disable"
        };

        if (moveEffectNames.hasOwnProperty(effectId)) {
            return moveEffectNames[effectId];
        }
        return this.language === 'fr' ? "Effet inconnu #" + effectId : "Unknown effect #" + effectId;
    }

    getTypeName(typeId) {

        // If typeId exists in our cache, return the localized name
        if (typeId && this.cache.types[typeId]) {
            return this.cache.types[typeId].name;
        }
        
        // Fallback for unknown types
        return this.language === 'fr' ? "Type #" + typeId : "Type #" + typeId;
    }

    getStatusText(statusByte) {
        if (statusByte === 0) return this.language === 'fr' ? "Aucun statut" : "No status";

        const statusNames = {
            0: this.language === 'fr' ? "OK" : "OK",
            1: this.language === 'fr' ? "Endormi" : "Asleep",
            2: this.language === 'fr' ? "Endormi" : "Asleep",
            3: this.language === 'fr' ? "Endormi" : "Asleep",
            4: this.language === 'fr' ? "Endormi" : "Asleep",
            8: this.language === 'fr' ? "Empoisonné" : "Poisoned",
            16: this.language === 'fr' ? "Brûlé" : "Burned",
            32: this.language === 'fr' ? "Gelé" : "Frozen",
            64: this.language === 'fr' ? "Paralysé" : "Paralyzed",
        };

        return statusNames[statusByte] || `[${statusByte}] ${this.language === 'fr' ? "Statut inconnu" : "Unknown status"}`;
    }

    getGymName(gymId) {
        const gymNames = {
            0x00: this.language === 'fr' ? "Argenta" : "Pewter City",
            0x01: this.language === 'fr' ? "Azuria" : "Cerulean City",
            0x02: this.language === 'fr' ? "Carmin sur Mer" : "Vermillon City",
            0x03: this.language === 'fr' ? "Céladopole" : "Celadopn City",
            0x04: this.language === 'fr' ? "Parmanie" : "Fuchsia City",
            0x05: this.language === 'fr' ? "Safrania" : "Safrania City",
            0x06: this.language === 'fr' ? "Cramois'Île" : "Cinnabar",
            0x07: this.language === 'fr' ? "Jadielle" : "Viridian",
            0x0A: this.language === 'fr' ? "Plateau Indigo" : "Indigo Plateau",
            0x0B: this.language === 'fr' ? "Rival" : "Rival"
        };

        if (gymNames.hasOwnProperty(gymId)) {
            return gymNames[gymId];
        }
        return this.language === 'fr' ? "Arène inconnue #" + gymId : "Unknown Gym #" + gymId;
    }

    getTrainerName(trainerId) {
        const trainerNames = {
            0x02: this.language === 'fr' ? "Pierre" : "Brock",
            0x03: this.language === 'fr' ? "Ondine" : "Misty",
            0x04: this.language === 'fr' ? "Major Bob" : "Lt. Surge",
            0x05: this.language === 'fr' ? "Erika" : "Erika",
            0x06: this.language === 'fr' ? "Koga" : "Koga",
            0x07: this.language === 'fr' ? "Sabrina" : "Sabrina",
            0x08: this.language === 'fr' ? "Auguste" : "Blaine",
            0x09: this.language === 'fr' ? "Giovanni" : "Giovanni",
            0x0A: this.language === 'fr' ? "Olga" : "Lorelei",
            0x0B: this.language === 'fr' ? "Aldo" : "Bruno",
            0x0C: this.language === 'fr' ? "Agatha" : "Agatha",
            0x0D: this.language === 'fr' ? "Peter" : "Lance",
            0x0E: this.language === 'fr' ? "Rival" : "Rival"
        };

        if (trainerNames.hasOwnProperty(trainerId)) {
            return trainerNames[trainerId];
        }
        return this.language === 'fr' ? "Dresseur #" + trainerId : "Trainer #" + trainerId;
    }
}

module.exports = PokeAPIClient;