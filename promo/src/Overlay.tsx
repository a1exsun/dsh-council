import {interpolate, spring, useCurrentFrame} from 'remotion';

// Inspired by template-overlay: a spring entrance and a separate, frame-driven
// exit. This is editorial annotation, visually distinct from the recorded UI.
export const Overlay = ({eyebrow, title, detail, accent = '#b9f4dd'}: {
  eyebrow: string; title: string; detail: string; accent?: string;
}) => {
  const f = useCurrentFrame();
  const enter = spring({frame:f, fps:30, config:{damping:18, stiffness:115}});
  return <div style={{position:'absolute',right:68,bottom:118,width:390,padding:'28px 30px',
    background:'#141c2cf2',border:'1px solid #566070',borderRadius:18,
    boxShadow:'0 24px 65px #02040a88',transform:`translateY(${interpolate(enter,[0,1],[45,0])}px) scale(${0.94+enter*0.06})`,opacity:Math.min(1,enter)}}>
    <div style={{fontSize:15,letterSpacing:2.6,color:accent,fontWeight:650,marginBottom:17}}>{eyebrow}</div>
    <div style={{fontSize:34,fontWeight:650,lineHeight:1.12,letterSpacing:-1,marginBottom:15}}>{title}</div>
    <div style={{fontSize:20,color:'#bcc4d3',lineHeight:1.5}}>{detail}</div>
    <div style={{height:3,width:52,background:accent,marginTop:22}} />
  </div>;
};
