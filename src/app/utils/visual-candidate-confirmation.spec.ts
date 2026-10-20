import { advanceVisualConfirmation } from './visual-candidate-confirmation';

describe('advanceVisualConfirmation', () => {
  it('requires two consecutive matches before exposing a suggestion', () => {
    const first = advanceVisualConfirmation('', 0, 'pikachu');
    expect(first).toEqual({ name: 'pikachu', consecutiveReadings: 1, confirmed: false });

    const second = advanceVisualConfirmation(first.name, first.consecutiveReadings, 'pikachu');
    expect(second).toEqual({ name: 'pikachu', consecutiveReadings: 2, confirmed: true });
  });

  it('restarts confirmation when the top candidate changes', () => {
    expect(advanceVisualConfirmation('pikachu', 1, 'raichu')).toEqual({
      name: 'raichu', consecutiveReadings: 1, confirmed: false,
    });
  });
});