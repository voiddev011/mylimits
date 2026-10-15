export function validateSyncOrigin(value:string):string {
 if(!value)return '';const u=new URL(value);
 if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw new Error('Sync origin requires HTTPS or loopback HTTP, without paths or credentials.');
 return u.origin;
}
export function syncPermission(origin:string){const u=new URL(validateSyncOrigin(origin));return `${u.protocol}//${u.hostname}/*`}
