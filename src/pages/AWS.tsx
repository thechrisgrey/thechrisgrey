import { SEO } from '../components/SEO';
import awsHero from '../assets/aws-hero.png';
import awsCommunityBuilder from '../assets/aws-community-builder.png';
import { typography } from '../utils/typography';
import { buildWebPageSchema } from '../utils/schemas';

const AWS = () => {
  const focusAreas = [
    {
      title: "AI & Machine Learning",
      description: "Building intelligent systems with Amazon Bedrock, SageMaker, and foundation models. From RAG pipelines to real-time inference, designing AI architectures that solve real problems.",
      services: ["Amazon Bedrock", "SageMaker", "Titan Embeddings", "Knowledge Bases"],
    },
    {
      title: "Cloud Architecture",
      description: "Designing serverless, event-driven systems on AWS that scale efficiently. Infrastructure as code, cost optimization, and operational excellence as first principles.",
      services: ["Lambda", "API Gateway", "DynamoDB", "CloudFormation"],
    },
    {
      title: "Community & Content",
      description: "Sharing knowledge through technical writing, open-source contributions, and community engagement. Helping others navigate the path from traditional infrastructure to cloud-native AI.",
      services: ["Technical Blogs", "Architecture Patterns", "Best Practices"],
    },
  ];

  return (
    <div className="min-h-screen bg-altivum-dark">
      <SEO
        title="Amazon Web Services"
        description="Christian Perez is an AWS Community Builder in AI Engineering, building intelligent cloud-native systems with Amazon Bedrock, Lambda, and serverless architectures."
        keywords="AWS Community Builder, AI Engineering, Amazon Bedrock, cloud architecture, serverless, Christian Perez AWS, Amazon Web Services"
        url="https://thechrisgrey.com/aws"
        breadcrumbs={[
          { name: "Home", url: "https://thechrisgrey.com" },
          { name: "Amazon Web Services", url: "https://thechrisgrey.com/aws" },
        ]}
        structuredData={[
          buildWebPageSchema({
            name: "Amazon Web Services - Christian Perez",
            description: "Christian Perez is an AWS Community Builder in AI Engineering.",
            url: "https://thechrisgrey.com/aws",
          }),
        ]}
      />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden opacity-0 animate-fade-in">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-6 sm:mb-8">
              <img
                src={awsHero}
                alt="AWS - AI Engineering"
                className="w-full max-w-6xl mx-auto opacity-90"
                fetchPriority="high"
              />
              <h1 className="sr-only">Amazon Web Services - AWS Community Builder in AI Engineering</h1>
            </div>
          </div>
        </div>
      </section>

      {/* Community Builder Banner */}
      <section className="relative overflow-hidden">
        <div className="relative">
          <img
            src={awsCommunityBuilder}
            alt="Christian Perez - AWS Community Builder"
            className="w-full h-auto block"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-altivum-dark via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-altivum-dark/40 via-transparent to-transparent" />
        </div>
      </section>

      {/* Introduction */}
      <section className="pb-24 md:pb-32 lg:pb-40 pt-16 md:pt-24">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <div className="mb-24 md:mb-32 text-center">
            <p className="text-white" style={typography.sectionHeader}>
              AWS <span className="text-altivum-gold">Community Builder</span>
            </p>
            <p className="text-altivum-silver mt-6" style={typography.subtitle}>
              AI Engineering
            </p>
          </div>

          <div className="mb-20 md:mb-24">
            <p className="text-white/80" style={typography.subtitle}>
              The <span className="text-white">AWS Community Builders</span> program provides
              technical resources, mentorship, and networking opportunities to AWS enthusiasts
              and emerging thought leaders who are passionate about sharing knowledge and
              connecting with the technical community.
            </p>
          </div>

          <div className="mb-20 md:mb-24">
            <p className="text-white/80" style={typography.subtitle}>
              I was accepted into the program under the{' '}
              <span className="text-altivum-gold">AI Engineering</span> track, reflecting
              the work I do every day at <span className="text-white">Altivum Inc.</span> — building
              production AI systems on AWS, from RAG-powered conversational agents to
              serverless inference pipelines and intelligent document processing.
            </p>
          </div>

          <div className="mb-20 md:mb-24">
            <p className="text-white/80" style={typography.subtitle}>
              This isn't a certification or a partnership. It's a{' '}
              <span className="text-white">recognition of builders</span> — people
              who are actively creating, learning, and sharing in the AWS ecosystem. For me,
              it's an extension of the same mission: translating complex cloud and AI
              capabilities into real-world impact.
            </p>
          </div>
        </div>
      </section>

      {/* Focus Areas */}
      <section className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-white mb-4" style={typography.sectionHeader}>
              Focus Areas
            </h2>
            <p className="text-altivum-silver max-w-2xl mx-auto" style={typography.subtitle}>
              Where I build and contribute
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {focusAreas.map((area, index) => (
              <div
                key={index}
                className="opacity-0 animate-fade-in"
                style={{ animationDelay: `${0.2 + index * 0.2}s` }}
              >
                <div className="bg-altivum-navy/30 border border-altivum-slate/30 p-8 rounded-lg hover:border-altivum-gold/30 transition-colors duration-300 group h-full flex flex-col">
                  <h3
                    className="text-white mb-4 group-hover:text-altivum-gold transition-colors duration-300"
                    style={typography.cardTitleLarge}
                  >
                    {area.title}
                  </h3>
                  <p className="text-altivum-silver mb-6 flex-grow" style={typography.bodyText}>
                    {area.description}
                  </p>
                  <div className="flex flex-wrap gap-2 border-t border-altivum-slate/20 pt-4">
                    {area.services.map((service) => (
                      <span
                        key={service}
                        className="text-xs text-altivum-gold/80 bg-altivum-gold/5 border border-altivum-gold/20 px-3 py-1 rounded-full"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What It Means */}
      <section className="py-24 bg-altivum-navy/10">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-white mb-4" style={typography.sectionHeader}>
              What This Means
            </h2>
          </div>

          <div className="space-y-8">
            <div className="border-l border-altivum-slate/30 pl-8 relative group">
              <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-altivum-slate/50 group-hover:bg-altivum-gold transition-colors duration-300" />
              <h3
                className="text-white mb-2 group-hover:text-altivum-gold transition-colors duration-300"
                style={typography.cardTitleLarge}
              >
                Direct Access
              </h3>
              <p className="text-altivum-silver" style={typography.bodyText}>
                Early access to AWS services, features, and the teams building them.
                The ability to test, provide feedback, and shape the tools before they
                reach general availability.
              </p>
            </div>

            <div className="border-l border-altivum-slate/30 pl-8 relative group">
              <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-altivum-slate/50 group-hover:bg-altivum-gold transition-colors duration-300" />
              <h3
                className="text-white mb-2 group-hover:text-altivum-gold transition-colors duration-300"
                style={typography.cardTitleLarge}
              >
                Knowledge Sharing
              </h3>
              <p className="text-altivum-silver" style={typography.bodyText}>
                A commitment to sharing what I learn through technical writing, blog posts,
                and community engagement. Documenting real-world patterns from production
                deployments, not theoretical exercises.
              </p>
            </div>

            <div className="border-l border-altivum-slate/30 pl-8 relative group">
              <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-altivum-slate/50 group-hover:bg-altivum-gold transition-colors duration-300" />
              <h3
                className="text-white mb-2 group-hover:text-altivum-gold transition-colors duration-300"
                style={typography.cardTitleLarge}
              >
                Builder Network
              </h3>
              <p className="text-altivum-silver" style={typography.bodyText}>
                Connection to a global network of builders, architects, and practitioners
                who are pushing the boundaries of what's possible on AWS. Peer learning
                from people solving the hardest problems in cloud and AI.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AWS;
