const acceptedImageTypes = ["image/png", "image/jpeg", "image/webp"];
const maxFileSize = 6 * 1024 * 1024;
const maxDataSize = 1200000;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    image.src = src;
  });
}

export function imageAccept() {
  return acceptedImageTypes.join(",");
}

export async function imageFileToDataUrl(file, maxSize = 900) {
  if (!acceptedImageTypes.includes(file.type)) {
    throw new Error("Use imagens em PNG, JPG ou WEBP.");
  }

  if (file.size > maxFileSize) {
    throw new Error("A imagem precisa ter até 6 MB.");
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(rawDataUrl);
  const ratio = Math.min(1, maxSize / image.width, maxSize / image.height);
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a imagem.");

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const webpDataUrl = canvas.toDataURL("image/webp", 0.82);
  if (webpDataUrl.length <= maxDataSize) return webpDataUrl;

  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.78);
  if (jpegDataUrl.length <= maxDataSize) return jpegDataUrl;

  throw new Error("A imagem ficou muito grande. Tente uma foto menor.");
}
