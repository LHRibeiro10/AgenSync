export default function BrandLogo({ className = "", src = "/AgenSync.png", imageClassName = "" }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        src={src}
        alt="AgenSync"
        className={`absolute left-1/2 top-1/2 h-full w-auto -translate-x-1/2 -translate-y-1/2 scale-[2.35] object-contain ${imageClassName}`}
      />
    </div>
  );
}
