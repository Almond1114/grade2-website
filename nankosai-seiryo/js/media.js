import {SITE_CONFIG} from './site-config.js?v=f4753749f056';
export async function prepareImage(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPEG・PNG・WebP画像を選択してください。');
  if(file.size>25*1024*1024)throw new Error('25MB以下の画像を選択してください。');
  const image=new Image(),url=URL.createObjectURL(file);
  try {
    image.src=url;await image.decode();
    const scale=Math.min(1,SITE_CONFIG.media.maxDimension/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    let quality=SITE_CONFIG.media.quality,blob;
    do {blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));quality-=.1;}while(blob&&blob.size>SITE_CONFIG.media.maxUploadBytes&&quality>.35);
    if(!blob||blob.size>SITE_CONFIG.media.maxUploadBytes)throw new Error('圧縮後の画像が大きすぎます。別の画像をお試しください。');
    const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
    return {dataUrl,fileName:file.name.replace(/\.[^.]+$/, '')+'.jpg',mimeType:'image/jpeg',width:canvas.width,height:canvas.height,bytes:blob.size,alt:''};
  }finally{URL.revokeObjectURL(url);}
}
