const TYPE_NAMES: Record<string, string> = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta',
  ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador',
  psychic: 'Psíquico', bug: 'Bicho', rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón',
  dark: 'Siniestro', steel: 'Acero', fairy: 'Hada',
};

const STAT_NAMES: Record<string, string> = {
  hp: 'PS', attack: 'Ataque', defense: 'Defensa', 'special-attack': 'Ataque especial',
  'special-defense': 'Defensa especial', speed: 'Velocidad',
};

const VERSION_GROUP_NAMES: Record<string, string> = {
  'red-blue': 'Rojo y Azul', yellow: 'Amarillo', 'gold-silver': 'Oro y Plata', crystal: 'Cristal',
  'ruby-sapphire': 'Rubí y Zafiro', emerald: 'Esmeralda', 'firered-leafgreen': 'Rojo Fuego y Verde Hoja',
  'diamond-pearl': 'Diamante y Perla', platinum: 'Platino', 'heartgold-soulsilver': 'Oro HeartGold y Plata SoulSilver',
  'black-white': 'Negro y Blanco', colosseum: 'Colosseum', xd: 'XD: Gale of Darkness',
  'black-2-white-2': 'Negro 2 y Blanco 2', 'x-y': 'X e Y', 'omega-ruby-alpha-sapphire': 'Rubí Omega y Zafiro Alfa',
  'sun-moon': 'Sol y Luna', 'ultra-sun-ultra-moon': 'Ultrasol y Ultraluna',
  'lets-go-pikachu-lets-go-eevee': 'Let’s Go, Pikachu! y Let’s Go, Eevee!',
  'sword-shield': 'Espada y Escudo', 'brilliant-diamond-shining-pearl': 'Diamante Brillante y Perla Reluciente',
  'legends-arceus': 'Leyendas Pokémon: Arceus', 'scarlet-violet': 'Escarlata y Púrpura',
};

export function spanishTypeName(type: string): string {
  return TYPE_NAMES[type.toLowerCase()] ?? humanize(type);
}

export function spanishStatName(stat: string): string {
  return STAT_NAMES[stat] ?? humanize(stat);
}

export function spanishVersionGroupName(versionGroup: string): string {
  return VERSION_GROUP_NAMES[versionGroup] ?? humanize(versionGroup);
}

export function humanize(value: string): string {
  return value.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}