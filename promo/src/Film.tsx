import {AbsoluteFill, Easing, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Audio, Video} from '@remotion/media';
import {Scene3D} from './Scene3D';
import {Overlay} from './Overlay';

export const FPS = 30;
export const ENTRY_DURATION = 720;
export const DURATION = 2688 + ENTRY_DURATION; // Original edit plus a 24-second entry chapter.
const ink = '#090e18', lilac = '#b8a4ff', mint = '#b9f4dd';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const ramp = (f:number,a:number,b:number) => interpolate(f,[a,b],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:ease});

const Brand = () => <div style={{display:'flex',alignItems:'center',gap:13,fontSize:21,letterSpacing:0.2,fontWeight:650}}>
  <div style={{display:'flex',gap:4,transform:'rotate(-18deg)'}}>{[lilac,mint,'#e6e0fb'].map((c,i)=><div key={c} style={{width:7,height:20+i*5,background:c,borderRadius:3}} />)}</div>
  DSH <span style={{color:'#9ea8bb',fontWeight:450}}>Council</span>
</div>;

const Background = () => <AbsoluteFill style={{background:ink}}>
  <AbsoluteFill style={{background:'radial-gradient(ellipse at 80% 28%, #30244366 0%, transparent 54%), radial-gradient(ellipse at 12% 96%, #183b3344, transparent 44%)'}} />
  <div style={{position:'absolute',inset:40,border:'1px solid #d1d7eb0d',borderRadius:24}} />
</AbsoluteFill>;

const Intro = () => {
  const f = useCurrentFrame();
  return <AbsoluteFill>
    <Background />
    <div style={{position:'absolute',left:84,top:65}}><Brand /></div>
    <div style={{position:'absolute',left:83,top:264,width:990,transform:`translateY(${(1-ramp(f,0,24))*45}px)`,opacity:ramp(f,0,18)}}>
      <div style={{fontSize:17,color:mint,letterSpacing:3.8,fontWeight:600,marginBottom:30}}>MULTI-MODEL DELIBERATION</div>
      <div style={{fontSize:110,letterSpacing:-6.2,lineHeight:1.03,fontWeight:630}}>Don’t stop<br/>at <span style={{color:lilac}}>one answer.</span></div>
      <div style={{fontSize:29,lineHeight:1.55,color:'#b7c0d1',marginTop:38,width:680,opacity:ramp(f,24,48)}}>Independent perspectives.<br/>A decision you can inspect.</div>
    </div>
    <div style={{position:'absolute',right:-65,top:10,opacity:ramp(f,12,40)}}><Scene3D /></div>
    <div style={{position:'absolute',left:84,bottom:104,display:'flex',gap:24,opacity:ramp(f,48,72)}}>
      {['ANSWER', 'REVIEW', 'DECIDE'].map((x,i)=><div key={x} style={{fontSize:17,letterSpacing:1.5,color:i===2?mint:'#d0c4ef',borderTop:`2px solid ${i===2?mint:'#73618f'}`,paddingTop:15,width:155}}>0{i+1} / {x}</div>)}
    </div>
    <div style={{position:'absolute',right:85,bottom:66,color:'#728199',fontSize:15,letterSpacing:2}}>BUILT FOR DEEPSEEK HARNESS</div>
  </AbsoluteFill>;
};

type Shot = {src:string; from:number; duration:number; trim?:number; crop?:[number,number,number,number]; speed?:number};
type ChapterProps = {number:string; title:string; strap:string; duration:number; shots:Shot[]; note:[string,string,string]; accent?:string; quote?:[string,string]};

const Recording = ({shot}: {shot:Shot}) => {
  const f=useCurrentFrame();
  const [x,y,w,h]=shot.crop??[310,140,970,590];
  const scale=1260/w;
  const bodyHeight=Math.min(673, Math.round(h*scale));
  return <div style={{position:'absolute',left:70,top:195,width:1260,height:bodyHeight+42,background:'#fff',borderRadius:17,overflow:'hidden',boxShadow:'0 32px 100px #0008',border:'1px solid #b9c3d13b',transform:`perspective(2200px) rotateY(${interpolate(ramp(f,0,36),[0,1],[-1.8,0])}deg)`}}>
    <div style={{height:42,background:'#f4f5f7',display:'flex',alignItems:'center',gap:7,padding:'0 18px',borderBottom:'1px solid #e5e7ec'}}>
      {['#d9dce2','#d9dce2','#d9dce2'].map((c,i)=><div key={i} style={{width:7,height:7,borderRadius:10,background:c}}/>)}
      <span style={{marginLeft:15,fontSize:14,color:'#737d8e',letterSpacing:0.4}}>DeepSeek Harness · Council</span>
      <span style={{marginLeft:'auto',fontSize:11,color:'#778979',letterSpacing:1.5}}>RECORDED IN APP</span>
    </div>
    <div style={{position:'absolute',left:0,top:42,width:1260,height:bodyHeight,overflow:'hidden'}}>
      <Video src={staticFile(`footage/${shot.src}.mp4`)} muted trimBefore={shot.trim??0} playbackRate={shot.speed??1}
        style={{position:'absolute',width:1600*scale,height:900*scale,left:-x*scale,top:-y*scale+(bodyHeight-h*scale)/2,maxWidth:'none'}} />
    </div>
  </div>;
};

const Chapter = ({number,title,strap,duration,shots,note,accent=mint,quote}:ChapterProps) => {
  const f = useCurrentFrame();
  const reveal=ramp(f,36,60);
  return <AbsoluteFill>
    <Background />
    <div style={{position:'absolute',left:74,top:57}}><Brand/></div>
    <div style={{position:'absolute',right:74,top:59,color:'#8c99af',fontSize:16,letterSpacing:2}}>PRODUCT WALKTHROUGH <span style={{color:accent,marginLeft:28}}>{number} / 06</span></div>
    <div style={{position:'absolute',left:74,top:117,fontSize:39,fontWeight:570,letterSpacing:-1.2}}>{title}<span style={{fontSize:18,color:'#8d9bb1',fontWeight:400,letterSpacing:0,marginLeft:27}}>{strap}</span></div>
    {shots.map((shot,i)=><Sequence key={i} from={shot.from} durationInFrames={shot.duration} premountFor={12}><Recording shot={shot}/></Sequence>)}
    {quote && <div style={{position:'absolute',left:82,top:708,width:1220,opacity:ramp(f,84,108)}}>
      <div style={{fontSize:14,letterSpacing:2.8,color:accent,marginBottom:16}}>FROM THIS RECORDED RUN</div>
      <div style={{fontSize:49,letterSpacing:-1.7,fontWeight:570}}>{quote[0]}</div>
      <div style={{fontSize:23,color:'#a9b6cb',marginTop:17}}>{quote[1]}</div>
    </div>}
    <div style={{position:'absolute',right:77,top:229,width:425,color:'#8593a9',fontSize:17,lineHeight:1.55}}>
      <div style={{fontSize:132,fontWeight:500,color:accent,lineHeight:1,letterSpacing:-8,marginBottom:20}}>{number}</div>
      <div style={{width:46,height:1,background:'#536079',marginBottom:22}} />
      <div style={{fontSize:21,color:'#c3ccdb'}}>One question.<br/>A complete deliberation.</div>
    </div>
    <Sequence from={72} durationInFrames={duration-72}><Overlay eyebrow={note[0]} title={note[1]} detail={note[2]} accent={accent}/></Sequence>
    <div style={{position:'absolute',bottom:57,left:75,right:75,display:'flex',gap:12}}>{['START','SELECT','ANSWER','REVIEW','DECIDE','INSPECT'].map((s,i)=><div key={s} style={{flex:1}}>
      <div style={{height:2,background:i+1===Number(number)?accent:'#2c3547',marginBottom:13}}/>
      <div style={{fontSize:12,letterSpacing:2,color:i+1===Number(number)?accent:'#66758d'}}>{s}</div>
    </div>)}</div>
    {/* Full-screen chapter cards; existing transition timing is preserved. */}
    {f<60 && <AbsoluteFill style={{background:ink,clipPath:`inset(0 ${reveal*100}% 0 0)`,overflow:'hidden'}}>
      <div style={{position:'absolute',left:82,top:60}}><Brand/></div>
      <div style={{position:'absolute',left:80,top:217,color:accent,fontSize:18,letterSpacing:5}}>CHAPTER {number}</div>
      <div style={{position:'absolute',left:77,top:331,fontSize:108,fontWeight:610,letterSpacing:-5.5,width:1390,lineHeight:1.06,transform:`translateY(${(1-ramp(f,0,18))*40}px)`,opacity:ramp(f,0,12)}}>{title}</div>
      <div style={{position:'absolute',left:84,top:608,fontSize:28,color:'#9faac0'}}>{strap}</div>
      <div style={{position:'absolute',right:45,top:30,opacity:0.48}}><Scene3D compact/></div>
      <div style={{position:'absolute',left:0,bottom:0,width:ramp(f,0,36)*1920,height:8,background:accent}}/>
    </AbsoluteFill>}
    {f>=duration-12 && <AbsoluteFill style={{background:accent,transform:`translateX(${interpolate(f,[duration-12,duration-1],[100,0])}%)`}}/>}
  </AbsoluteFill>;
};

const Outro = () => {
  const f=useCurrentFrame();
  return <AbsoluteFill>
    <Background/>
    <div style={{position:'absolute',left:84,top:65}}><Brand/></div>
    <div style={{position:'absolute',right:-105,top:-50,opacity:0.55}}><Scene3D/></div>
    <div style={{position:'absolute',left:84,top:240,opacity:ramp(f,0,18),transform:`translateY(${(1-ramp(f,0,24))*40}px)`}}>
      <div style={{fontSize:98,fontWeight:610,lineHeight:1.06,letterSpacing:-5}}>Bring a council<br/>to your <span style={{color:mint}}>conversation.</span></div>
      <div style={{display:'inline-flex',marginTop:43,fontSize:42,fontWeight:550,padding:'16px 34px',borderRadius:13,background:lilac,color:ink,letterSpacing:-1}}>/council</div>
      <div style={{marginTop:26,fontSize:23,color:'#b1bdd0'}}>Inside DeepSeek Harness. Using your configured models.</div>
      <div style={{marginTop:28,fontSize:19,color:mint}}>github.com/a1exsun/dsh-council <span style={{marginLeft:15}}>↗</span></div>
    </div>
    <div style={{position:'absolute',left:84,bottom:95,color:'#8591a5',fontSize:15,lineHeight:1.6}}>Multi-model agreement is not a guarantee of correctness.<br/>Music: “Great Fairy Fountain” — arranged by Brock Hewitt<br/>Original composition: Koji Kondo · Nintendo · brockhewittstories.bandcamp.com</div>
    <AbsoluteFill style={{background:ink,opacity:ramp(f,264,288)}}/>
  </AbsoluteFill>;
};

export const CouncilFilm = () => <AbsoluteFill style={{fontFamily:'Inter, sans-serif',color:'#f3f4f9'}}>
  <Sequence durationInFrames={192}><Intro/></Sequence>
  <Sequence from={192} durationInFrames={ENTRY_DURATION}><Chapter number="01" title="Start with /council." strap="New conversation. One command. Your question." duration={ENTRY_DURATION}
    shots={[
      {src:'00-entry-command',from:60,duration:72,crop:[0,0,1600,900]},
      {src:'00-entry-command',from:132,duration:108,trim:72,crop:[480,260,940,500]},
      {src:'00-entry-open',from:240,duration:36,crop:[0,0,1600,900]},
      {src:'00-entry-topic-navigation',from:276,duration:84,crop:[0,0,1600,900]},
      {src:'00-entry-question',from:360,duration:360,crop:[490,275,900,480]},
    ]} note={['QUICK START','Right inside DSH.','Create a new conversation, open /council, and enter your question.']}/></Sequence>
  <Sequence from={192 + ENTRY_DURATION} durationInFrames={480}><Chapter number="02" title="Choose your council." strap="Your models. Three distinct roles." duration={480}
    shots={[
      {src:'01-answerers',from:36,duration:108,trim:0},
      {src:'03-reviewers-select',from:144,duration:108,trim:0},
      {src:'04-arbiter-open',from:252,duration:96,trim:0},
      {src:'06-topic',from:348,duration:132,trim:0},
    ]} note={['BUILD YOUR PANEL','Separate roles.','Choose who answers, who reviews, and who makes the final synthesis.']}/></Sequence>
  <Sequence from={672 + ENTRY_DURATION} durationInFrames={384}><Chapter number="03" title="Start independently." strap="Fresh context for every answerer." duration={384}
    shots={[{src:'08-answer',from:36,duration:156,trim:108,crop:[330,90,920,491]},{src:'08b-answer',from:192,duration:192,trim:6,crop:[330,185,920,491]}]}
    note={['INDEPENDENT ANSWERS','More than one view.','Answerers work in parallel, each in a fresh DSH child session.']} accent={lilac}/></Sequence>
  <Sequence from={1056 + ENTRY_DURATION} durationInFrames={480}><Chapter number="04" title="Review the ideas." strap="Anonymous answers. Structured comparison." duration={480}
    shots={[{src:'09-review',from:36,duration:444,crop:[840,152,700,374]}]}
    note={['ANONYMOUS REVIEW','Evidence over identity.','Compare strengths, weaknesses, contradictions, and coverage gaps.']}/></Sequence>
  <Sequence from={1536 + ENTRY_DURATION} durationInFrames={480}><Chapter number="05" title="Reach a reasoned decision." strap="One synthesis, with its assumptions." duration={480}
    shots={[{src:'10-decision',from:36,duration:444,crop:[352,383,882,274]}]}
    quote={['PostgreSQL leasing.','At-least-once delivery · Idempotency keys · Ownership checks']}
    note={['FINAL SYNTHESIS','Resolve the trade-offs.','The arbiter weighs answers and reviews to explain a final recommendation.']} accent={lilac}/></Sequence>
  <Sequence from={2016 + ENTRY_DURATION} durationInFrames={384}><Chapter number="06" title="Inspect the reasoning." strap="The result is only the beginning." duration={384}
    shots={[{src:'11-audit',from:36,duration:348,crop:[352,383,882,274]}]}
    quote={['A tied ranking. A reasoned synthesis.','Both answers averaged 1.50 across two independent reviews.']}
    note={['INSPECTABLE OUTPUT','Follow the evidence.','Inspect identity mappings, average ranks, confidence notes, and failures.']}/></Sequence>
  <Sequence from={2400 + ENTRY_DURATION} durationInFrames={288}><Outro/></Sequence>
  <Audio src={staticFile('audio/great-fairy-fountain-preview.mp3')} trimBefore={732} volume={(f)=>interpolate(f,[0,30,DURATION-96,DURATION],[0,0.6,0.6,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}/>
</AbsoluteFill>;
