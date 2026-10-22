import {Composition} from "remotion";
import {MyComponent} from "./Composition";
import scenes from "../public/scenes.json";
export const RemotionRoot=()=> <Composition id="AirlockWeek2" component={MyComponent} width={1920} height={1080} fps={15} durationInFrames={scenes.reduce((sum,s)=>sum+s.frames,0)}/>;
