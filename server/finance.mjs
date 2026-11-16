export function toKobo(value) {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(String(value))) throw new Error('Enter a valid amount with at most two decimal places.');
  const [whole, fraction=''] = String(value).split('.');
  const result = Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if (!Number.isSafeInteger(result)||result<=0||result>10000000000) throw new Error('Amount must be between ₦0.01 and ₦100,000,000.');
  return result;
}
export function plan(balance, target, deadline, now=new Date()) {
  const remaining=Math.max(0,target-balance);
  const days=Math.max(1,Math.ceil((new Date(deadline).getTime()-now.getTime())/86400000));
  return {remaining,days,daily:Math.ceil(remaining/days),weekly:Math.ceil(remaining*7/days),monthly:Math.ceil(remaining*30/days),progress:target>0?Math.min(100,balance/target*100):0};
}
