export default function BrandLogo({ className = "", src = "/app-logo.png", imageClassName = "" }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        src={src}
        alt="AgenSync"
        className={`h-full w-full object-contain ${imageClassName}`}
      />
    </div>
  );
}
