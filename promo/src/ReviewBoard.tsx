import {interpolate, spring, useCurrentFrame} from 'remotion';

// Editorial summary of the recorded reviews, not a replica of DSH's UI.
// The evidence and actual aggregate ranks are documented in CREDITS.md.
const answers = [
  {
    label: 'Answer A',
    color: '#b8a4ff',
    strength: 'Concrete claim SQL.',
    finding: 'Make expired-lease recovery explicit.',
  },
  {
    label: 'Answer B',
    color: '#b9f4dd',
    strength: 'Primary-source documentation.',
    finding: 'Separate intent from confirmed success.',
  },
];

const appear = (frame: number, start: number) => interpolate(frame, [start, start + 18], [0, 1], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});

export const ReviewBoard = () => {
  const frame = useCurrentFrame();
  return <div style={{position:'absolute',left:70,top:202,width:1260}}>
    <div style={{display:'flex',justifyContent:'space-between',fontSize:15,letterSpacing:2.4,color:'#9eacc3'}}>
      <span>ANONYMOUS COMPARISON</span>
      <span>FROM THE RECORDED RUN</span>
    </div>
    <div style={{fontSize:42,fontWeight:580,letterSpacing:-1.5,marginTop:17,marginBottom:28}}>What the reviewers found.</div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
      {answers.map((answer, i) => {
        const enter = spring({frame:frame-i*8,fps:30,config:{damping:22,stiffness:120}});
        return <div key={answer.label} style={{height:510,padding:30,display:'flex',flexDirection:'column',
          background:'#121c2c',border:'1px solid #3b4960',borderTop:`3px solid ${answer.color}`,borderRadius:18,
          boxShadow:'0 24px 60px #0004',opacity:Math.min(1,enter),transform:`translateY(${(1-enter)*28}px)`}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:38,fontWeight:620,letterSpacing:-1,color:answer.color}}>{answer.label}</span>
            <span style={{fontSize:14,color:'#9ca9bd'}}>Model identity hidden</span>
          </div>
          <div style={{marginTop:34,opacity:appear(frame,24+i*8)}}>
            <div style={{fontSize:14,letterSpacing:2.2,color:'#b9f4dd',marginBottom:12}}>STRENGTH</div>
            <div style={{fontSize:29,lineHeight:1.25,fontWeight:520}}>{answer.strength}</div>
          </div>
          <div style={{marginTop:30,opacity:appear(frame,90+i*8)}}>
            <div style={{fontSize:14,letterSpacing:2.2,color:'#f4cda4',marginBottom:12}}>REVIEW FINDING</div>
            <div style={{fontSize:29,lineHeight:1.3,fontWeight:520}}>{answer.finding}</div>
          </div>
          <div style={{marginTop:'auto',paddingTop:18,borderTop:'1px solid #344159',display:'flex',alignItems:'baseline',gap:18,opacity:appear(frame,180)}}>
            <span style={{fontSize:55,letterSpacing:-2,fontWeight:600,color:answer.color}}>1.50</span>
            <span style={{fontSize:19,color:'#aab7cc'}}>average rank · 2 reviews</span>
          </div>
        </div>;
      })}
    </div>
    <div style={{marginTop:22,fontSize:20,color:'#aab7cc',opacity:appear(frame,198)}}>
      Both recommend PostgreSQL. The reviews expose gaps before the final decision.
    </div>
  </div>;
};
