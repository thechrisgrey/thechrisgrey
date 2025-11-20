import { SEO } from '../components/SEO';
import btaLogo from '../assets/bta.png';

const BeyondTheAssessment = () => {
  return (
    <div className="min-h-screen bg-altivum-dark">
      <SEO
        title="Beyond the Assessment"
        description="Beyond the Assessment: A book by Christian Perez on leadership, resilience, and the human element in special operations and business."
        keywords="Beyond the Assessment, Christian Perez book, leadership book, special operations leadership, resilience"
        url="https://thechrisgrey.com/beyond-the-assessment"
        type="article"
      />
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden opacity-0 animate-fade-in">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-6 sm:mb-8">
              <img
                src={btaLogo}
                alt="Beyond the Assessment"
                className="w-full max-w-3xl mx-auto opacity-90"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BeyondTheAssessment;
