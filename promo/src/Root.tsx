import './index.css';
import {Composition, staticFile} from 'remotion';
import {loadFont} from '@remotion/fonts';
import {CouncilFilm, DURATION, FPS} from './Film';

loadFont({family:'Inter', url:staticFile('fonts/Inter.ttf'), weight:'100 900'});

export const RemotionRoot = () => <Composition id="CouncilFilm" component={CouncilFilm}
  durationInFrames={DURATION} fps={FPS} width={1920} height={1080}/>;
