import Eyebrow from './Eyebrow';
import CountUp from './CountUp';

/**
 * (THE RECORD) — four serif stats scattered asymmetrically on desktop
 * (the reference's signature layout), stacked 2-col on mobile. Values are
 * editable content; the layout supports 3-5 stats.
 */
const STATS = [
  { value: 18, suffix: 'D', caption: 'Special Forces Medical Sergeant', desktop: 'md:absolute md:left-[8%] md:top-[10%]' },
  { value: 60, suffix: '+', caption: 'podcast episodes & conversations', desktop: 'md:absolute md:right-[12%] md:top-0' },
  { value: 1, suffix: '', caption: 'book — Beyond the Assessment', desktop: 'md:absolute md:bottom-[18%] md:left-[34%]' },
  { value: 3, suffix: 'x', caption: 'ventures built and operating', desktop: 'md:absolute md:bottom-0 md:right-[8%]' },
];

const RecordSection = () => (
  <section className="mx-auto max-w-7xl px-6 py-24 md:py-36 lg:px-12" aria-label="The record">
    <Eyebrow>THE RECORD</Eyebrow>
    <div className="relative mt-12 grid grid-cols-2 gap-10 md:block md:h-[26rem]">
      {STATS.map((stat) => (
        <CountUp
          key={stat.caption}
          value={stat.value}
          suffix={stat.suffix}
          caption={stat.caption}
          className={stat.desktop}
        />
      ))}
    </div>
  </section>
);

export default RecordSection;
