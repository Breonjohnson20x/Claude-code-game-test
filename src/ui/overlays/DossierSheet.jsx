// The dossier (TopBar "Council"): who knows the Crown and how they feel (Master Build §16), the
// powers on the border and what they call Elvia (Cycle doc §4 civilization memory), and the world.
// Words only — never raw relationship numbers or NarrativeIntensity.

import { useRef, useState } from 'react';
import { useGame } from '../game/GameProvider.jsx';
import { Sheet } from '../kit/kit.jsx';
import { Tabs } from './dossier/Tabs.jsx';
import { CouncilTab } from './dossier/CouncilTab.jsx';
import { FactionsTab } from './dossier/FactionsTab.jsx';
import { WorldTab } from './dossier/WorldTab.jsx';

const TABS = [
  { id: 'council', label: 'Council', icon: 'council' },
  { id: 'factions', label: 'Factions', icon: 'flag' },
  { id: 'world', label: 'The World', icon: 'map' },
];

const ID = 'dossier';

export function DossierSheet({ open, onClose }) {
  const { state } = useGame();
  const [tab, setTab] = useState('council');
  const bodyRef = useRef(null);

  if (!state) return null;
  const change = (id) => {
    setTab(id);
    bodyRef.current?.closest('.scroll-elvia')?.scrollTo?.({ top: 0 });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Council & Realm" eyebrow="The dossier · words, not numbers" wide>
      <div ref={bodyRef}>
        <Tabs tabs={TABS} value={tab} onChange={change} idBase={ID} label="Dossier sections" className="sticky -top-4 z-10 -mx-1 shadow-[0_8px_16px_-8px_rgb(4_8_15/0.9)]" />
        <div id={`${ID}-panel-${tab}`} role="tabpanel" aria-labelledby={`${ID}-tab-${tab}`} tabIndex={0} className="mt-4 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lattice-200">
          {tab === 'council' ? <CouncilTab state={state} /> : tab === 'factions' ? <FactionsTab state={state} /> : <WorldTab state={state} />}
        </div>
      </div>
    </Sheet>
  );
}
