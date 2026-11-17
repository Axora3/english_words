// Shared validation for registration and private profile edits.
export const PROFILE_TEXT = {
 mn:{firstName:'Нэр',lastName:'Овог',nickname:'Nickname',repeatPassword:'Нууц үг давтах',profile:'Миний профайл',photo:'Профайл зураг',photoHelp:'JPG, PNG эсвэл WebP · 2 MB хүртэл. Зураг зөвхөн таны профайлд хадгалагдана.',removePhoto:'Зураг хасах',namesRequired:'Овог, нэрээ оруулна уу (тус бүр 60 тэмдэгт хүртэл).',nicknameInvalid:'Nickname нь 3–24 үсэг, тоо, доогуур зураас эсвэл цэг байна.',passwordMismatch:'Давтан оруулсан нууц үг таарахгүй байна.',invalidCredentials:'Имэйл эсвэл нууц үг буруу байна. Дансгүй бол “Бүртгүүлэх”-ийг сонгоно уу. Нууц үгээ мартсан бол доорх товчоор сэргээнэ үү.',emailNotConfirmed:'Имэйлээ хараахан баталгаажуулаагүй байна. Ирсэн захиа болон Spam хавтсаа шалгаарай.',resendConfirmation:'Баталгаажуулах захиа дахин авах',confirmationSent:'Баталгаажуулах захиаг илгээлээ. Имэйл болон Spam хавтсаа шалгана уу.',emailRegistered:'Энэ имэйл бүртгэлтэй байна. Нэвтрэх эсвэл нууц үгээ сэргээнэ үү.',rateLimited:'Хэт олон удаа оролдсон байна. Түр хүлээгээд дахин оролдоно уу.',signupDisabled:'Шинэ бүртгэл одоогоор хаалттай байна.',photoInvalid:'2 MB хүртэлх JPG, PNG эсвэл WebP зураг сонгоно уу.',photoUnreadable:'Зургийг уншиж чадсангүй. Өөр зураг сонгоно уу.',profileSetup:'Профайлаа гүйцээнэ үү',profileMigration:'Профайлын шинэ тохиргоо сервер дээр хараахан суулгагдаагүй байна.',emailHelp:'Нэвтрэхдээ nickname биш, бүртгүүлсэн имэйлээ ашиглана.',saved:'Профайл хадгалагдлаа.'},
 en:{firstName:'First name',lastName:'Last name',nickname:'Nickname',repeatPassword:'Repeat password',profile:'My profile',photo:'Profile photo',photoHelp:'JPG, PNG or WebP · up to 2 MB. Your photo is stored privately on your profile.',removePhoto:'Remove photo',namesRequired:'Enter your first and last names (up to 60 characters each).',nicknameInvalid:'Use 3–24 letters, numbers, underscores or dots for your nickname.',passwordMismatch:'The passwords do not match.',invalidCredentials:'Email or password is incorrect. Choose Sign up if you do not have an account, or reset your password below.',emailNotConfirmed:'Confirm your email first. Check your inbox and spam folder.',resendConfirmation:'Resend confirmation email',confirmationSent:'Confirmation email sent. Check your inbox and spam folder.',emailRegistered:'This email is already registered. Sign in or reset your password.',rateLimited:'Too many attempts. Please wait before trying again.',signupDisabled:'New registrations are currently disabled.',photoInvalid:'Choose a JPG, PNG or WebP image up to 2 MB.',photoUnreadable:'Could not read this image. Choose another one.',profileSetup:'Complete your profile',profileMigration:'The new profile setup has not been installed on the server yet.',emailHelp:'Sign in with your registered email, not your nickname.',saved:'Profile saved.'}
};
export const profileText = (state,key) => PROFILE_TEXT[state.settings.language==='mn'?'mn':'en'][key];
export const signupPhotoHelp = state => state.settings.language==='mn'?'Сонголтоор · 2 MB хүртэл. Имэйлээ баталгаажуулаад энэ хөтөч дээр анх нэвтрэхэд зураг хадгалагдана.':'Optional · up to 2 MB. Your photo is saved when you confirm your email and first sign in using this browser.';
export function validateProfile(fields){
 const first_name=String(fields.first_name||'').trim(),last_name=String(fields.last_name||'').trim(),nickname=String(fields.nickname||'').trim();
 if(!first_name||!last_name||[first_name,last_name].some(v=>v.length>60||/[\r\n\t\x00-\x1f]/.test(v)))return {error:'namesRequired'};
 if(!/^[\p{L}\p{N}_.]{3,24}$/u.test(nickname))return {error:'nicknameInvalid'};
 return {value:{first_name,last_name,nickname}};
}
export function authErrorKey(error){
 const code=error?.code, message=error?.message||'';
 if(code==='invalid_credentials'||/invalid login credentials/i.test(message))return 'invalidCredentials';
 if(code==='email_not_confirmed')return 'emailNotConfirmed';
 if(['user_already_exists','email_exists'].includes(code))return 'emailRegistered';
 if(['over_email_send_rate_limit','over_request_rate_limit'].includes(code)||error?.status===429)return 'rateLimited';
 if(code==='signup_disabled')return 'signupDisabled';
 return null;
}
export function validAvatar(value){return value===null||typeof value==='string'&&value.length<=120000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value);}
const PENDING_PHOTO='english-words-pending-profile-photo';
export function stageAvatar(user,email,avatar,storage=globalThis.localStorage){
 if(!user?.id||!avatar||!validAvatar(avatar))return;
 storage.setItem(PENDING_PHOTO,JSON.stringify({id:user.id,email:email.trim().toLowerCase(),avatar,at:Date.now()}));
}
export function pendingAvatar(user,storage=globalThis.localStorage){
 try{const saved=JSON.parse(storage.getItem(PENDING_PHOTO)||'null');
  if(!saved||saved.id!==user?.id||saved.email!==user?.email?.trim().toLowerCase()||Date.now()-saved.at>7*86400000||!validAvatar(saved.avatar))return null;
  return saved.avatar;
 }catch{return null;}
}
export function clearPendingAvatar(storage=globalThis.localStorage){storage.removeItem(PENDING_PHOTO);}
export async function readAvatar(file){
 if(!file||file.size>2*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('photoInvalid');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=url;await img.decode();
  if(!img.width||!img.height||img.width*img.height>40000000)throw Error();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=192;
  const side=Math.min(img.width,img.height);canvas.getContext('2d').drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,192,192);
  const value=canvas.toDataURL('image/jpeg',0.8);if(!validAvatar(value))throw Error();return value;
 }catch{throw Error('photoUnreadable');}finally{URL.revokeObjectURL(url);}
}
