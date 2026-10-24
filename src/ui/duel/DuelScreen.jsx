// TEMPORARY STUB — replaced by the DUEL agent. API: <DuelScreen config onComplete onExit? />
import { simulateDuel, createOracleBot } from '../../game/duel/bots.js';
import { getDuelResult } from '../../game/duel/engine.js';

export function DuelScreen({ config, onComplete }) {
  const finish = () => {
    const { duel } = simulateDuel(config, createOracleBot({ mode: 'parry' }), { maxMs: 240000 });
    onComplete(getDuelResult(duel));
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950 text-parchment-100">
      <button type="button" className="btn-royal" onClick={finish}>Resolve duel (stub)</button>
    </div>
  );
}
export default DuelScreen;
