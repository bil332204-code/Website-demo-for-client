export default function Atmosphere(){
 return <div className="atmosphere" aria-hidden="true"><div className="ambient-glow glow-a"/><div className="ambient-glow glow-b"/><div className="ambient-contour contour-a"/><div className="ambient-contour contour-b"/><div className="orbital-streak streak-a"/><div className="orbital-streak streak-b"/>{Array.from({length:18},(_,i)=><span className="ambient-particle" key={i} style={{'--left':`${(i*37+7)%100}%`,'--top':`${(i*23+13)%100}%`,'--duration':`${12+i%6*3}s`,'--delay':`${-i*1.7}s`,'--size':`${i%3===0?3:2}px`}}/>)}</div>;
}
