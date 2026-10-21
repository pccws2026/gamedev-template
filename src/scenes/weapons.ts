export type WeaponType = 'pistol' | 'shotgun' | 'assaultRifle';

export const WEAPON_CONFIG: Record<WeaponType, {
  tapFireFrames: number;
  holdFireFrames: number;
  ptCost: number;
}> = {
  pistol: {
    tapFireFrames: 5,
    holdFireFrames: 20,
    ptCost: 2,
  },
  shotgun: {
    tapFireFrames: 25,
    holdFireFrames: 25,
    ptCost: 6,
  },
  assaultRifle: {
    tapFireFrames: 6,
    holdFireFrames: 6,
    ptCost: 4,
  },
};
