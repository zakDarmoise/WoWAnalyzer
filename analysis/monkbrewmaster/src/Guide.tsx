import colorForPerformance from 'common/colorForPerformance';
import SPELLS from 'common/SPELLS';
import { SpellLink } from 'interface';
import { GuideProps, Section, SubSection } from 'interface/guide';
import { DamageEvent } from 'parser/core/Events';
import { useCallback, useState } from 'react';

import CombatLogParser from './CombatLogParser';
import './MicroTimeline.scss';
import './HitsList.scss';
import { TrackedHit } from './modules/spells/Shuffle';

type Segment = {
  value: boolean;
  width: number;
};

function CoalescingMicroTimeline({
  values,
  onRender,
}: {
  values: boolean[];
  onRender: (node: HTMLDivElement) => void;
}) {
  const initialValue: {
    currentValue?: boolean;
    currentLength: number;
    segments: Segment[];
  } = { currentLength: 0, segments: [] };
  const { segments, currentValue, currentLength } =
    values.length === 0
      ? { segments: [{ value: true, width: 1 }], currentLength: 0, currentValue: undefined }
      : values.reduce(({ currentValue, currentLength, segments }, value) => {
          if (value !== currentValue) {
            currentLength > 0 &&
              segments.push({ value: currentValue!, width: currentLength / values.length });
            return {
              currentLength: 1,
              currentValue: value,
              segments,
            };
          } else {
            return {
              currentLength: currentLength + 1,
              currentValue,
              segments,
            };
          }
        }, initialValue);

  if (currentLength > 0 && currentValue !== undefined) {
    segments.push({ value: currentValue, width: currentLength / values.length });
  }

  return (
    <div className="micro-timeline-coalescing" ref={onRender}>
      {segments.map(({ value, width }, ix) => (
        <div
          style={{
            width: `${width * 100}%`,
            backgroundColor: colorForPerformance(value ? 1 : 0),
          }}
          key={ix}
        ></div>
      ))}
    </div>
  );
}

function blockSize(numValues: number, refWidth: number): number | 'coalesce' {
  const size = refWidth / numValues - 1;
  console.log(numValues, refWidth, size);

  if (size < 4) {
    return 'coalesce';
  }

  return Math.min(Math.floor(size), 6);
}

function MicroTimeline({ values }: { values: boolean[] }) {
  const [refWidth, setRefWidth] = useState(800);
  const ref = useCallback((node: HTMLDivElement) => {
    console.log(node);
    node && setRefWidth(node.getBoundingClientRect().width);
  }, []);
  const size = blockSize(values.length, refWidth);

  if (size === 'coalesce') {
    return <CoalescingMicroTimeline values={values} onRender={ref} />;
  }

  return (
    <div className="micro-timeline-block" ref={ref}>
      {values.map((value, ix) => (
        <div
          key={ix}
          style={{
            backgroundColor: colorForPerformance(value ? 1 : 0),
            width: size,
            height: size,
          }}
        />
      ))}
    </div>
  );
}

function PassFailBar({ pass, total }: { pass: number; total: number }) {
  const perf = pass / total;
  return (
    <div className="pass-fail-bar-container">
      <div className="pass-bar" style={{ minWidth: `${perf * 100}%` }} />
      {perf < 1 && <div className="fail-bar" style={{ minWidth: `${(1 - perf) * 100}%` }} />}
    </div>
  );
}

type HitData = {
  ability: DamageEvent['ability'];
  total: number;
  pass: number;
};

function HitsList({ hits, style }: { hits: TrackedHit[]; style?: React.CSSProperties }) {
  const byAbility = hits.reduce<{ [key: number]: HitData }>((byAbility, { event, mitigated }) => {
    const datum = byAbility[event.ability.guid] ?? {
      ability: event.ability,
      total: 0,
      pass: 0,
    };

    datum.total += 1;
    datum.pass += mitigated ? 1 : 0;

    byAbility[event.ability.guid] = datum;

    return byAbility;
  }, {});

  return (
    <dl className="hits-list" style={style}>
      {Object.values(byAbility)
        .sort((a, b) => b.total - a.total)
        .map(({ ability, total, pass }) => (
          <>
            <dt>{ability.guid > 1 ? <SpellLink id={ability.guid} /> : ability.name}</dt>
            <dd className="pass-fail-counts">
              {pass} / {total}
            </dd>
            <dd>
              <PassFailBar pass={pass} total={total} />
            </dd>
          </>
        ))}
    </dl>
  );
}

export default function Guide({ modules }: GuideProps<typeof CombatLogParser>) {
  return (
    <>
      <Section title="Stagger Management">
        <p>
          <SpellLink id={SPELLS.STAGGER.id} /> spreads a portion of damage taken over a 10 second
          window. In doing so, it makes Brewmasters easy to heal&mdash;as long as you manage it
          well. There are two key elements to managing <SpellLink id={SPELLS.STAGGER.id} />:
          <ul>
            <li>
              Maintaining <SpellLink id={SPELLS.SHUFFLE.id} /> to improve the amount of damage that
              is Staggered.
            </li>
            <li>
              Using <SpellLink id={SPELLS.PURIFYING_BREW.id} /> to keep the damage dealt by{' '}
              <SpellLink id={SPELLS.STAGGER.id} /> from getting too high.
            </li>
          </ul>
        </p>
        <SubSection title="Shuffle">
          <SpellLink id={SPELLS.SHUFFLE.id} /> provides a significant increase to the amount of
          damage you <SpellLink id={SPELLS.STAGGER.id} />. Getting hit without{' '}
          <SpellLink id={SPELLS.SHUFFLE.id} /> active is very dangerous&mdash;and in many cases
          lethal.
          <SubSection title="Hits with Shuffle Active">
            <MicroTimeline values={modules.shuffle.hits.map(({ mitigated }) => mitigated)} />
            <HitsList hits={modules.shuffle.hits} style={{ marginTop: '1em' }} />
          </SubSection>
        </SubSection>
      </Section>
      <Section title="Celestial Brew"></Section>
    </>
  );
}
