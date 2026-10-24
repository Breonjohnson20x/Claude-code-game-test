// TEMPORARY STUB — replaced by the ART agent. API: <CampfireScene intensity className />
export function CampfireScene({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 ${className}`}
      style={{ background: 'radial-gradient(ellipse at 50% 85%, #7a3410 0%, #1a0f0a 45%, #05070c 100%)' }}
    />
  );
}
export default CampfireScene;
