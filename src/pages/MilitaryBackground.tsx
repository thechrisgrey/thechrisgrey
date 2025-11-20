import { SEO } from '../components/SEO';
import militaryLogo from '../assets/18d.png';

const MilitaryBackground = () => {
  return (
    <div className="min-h-screen bg-altivum-dark">
      <SEO
        title="Military Background"
        description="Christian Perez's military service as a Special Forces Medic (18D). The foundation of leadership, discipline, and operational excellence."
        keywords="Green Beret, 18D, Special Forces Medic, military service, veteran, Christian Perez military"
        url="https://thechrisgrey.com/military"
      />
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden opacity-0 animate-fade-in">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-6 sm:mb-8">
              <img
                src={militaryLogo}
                alt="Military Background - Former Green Beret, 18D"
                className="w-full max-w-3xl mx-auto opacity-90"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MilitaryBackground;
