import type { NaturalCaptureFact } from '../types';
import { resolveCaptureDate } from '../timeResolver';
import type { CapturePreparation, ResolvedCaptureEntity } from './types';

function percent(fact: NaturalCaptureFact): number | undefined {
  const p=fact.progress;
  if(!p) return undefined;
  if(p.kind==='PERCENT') return Math.round(Math.max(0,Math.min(100,p.value)));
  if(p.kind==='FRACTION') return Math.round(Math.max(0,Math.min(1,p.value))*100);
  return undefined;
}

export function prepareMediaCapture(
  fact: NaturalCaptureFact,
  entity: Extract<ResolvedCaptureEntity,{entityType:'MEDIA'}>,
  now=new Date(),
): CapturePreparation {
  const occurredOn=resolveCaptureDate(fact.occurredAt,now);
  const approximate=Boolean(fact.occurredAt?.approximate)||fact.progress?.approximation==='ABOUT';

  if(fact.progress?.kind==='EPISODES'){
    if(entity.mediaType!=='SERIES'){
      return {status:'UNSUPPORTED',reason:'Episode counts require a resolved series.',source:fact};
    }
    const count=Math.floor(fact.progress.value);
    if(count<=0) return {status:'UNSUPPORTED',reason:'Episode count must be positive.',source:fact};
    return {
      status:'READY',
      requiresConfirmation:true,
      summary:`Mark next ${count} unwatched episode${count===1?'':'s'} of "${entity.title}" watched${occurredOn?' on '+occurredOn:''}.`,
      operation:{kind:'MARK_NEXT_SERIES_EPISODES',entity,count,occurredOn},
      source:fact,
    };
  }

  if(fact.event==='FINISHED'){
    return {
      status:'READY',
      requiresConfirmation:approximate,
      summary:`Mark "${entity.title}" completed${occurredOn?' on '+occurredOn:''}.`,
      operation:{
        kind:'UPDATE_MEDIA',
        entity,
        patch:{progress:100,watchStatus:'COMPLETED',completedOn:occurredOn??null},
        occurredOn,
      },
      source:fact,
    };
  }

  if(fact.event==='STARTED'){
    return {
      status:'READY',
      requiresConfirmation:approximate||Boolean(fact.occurredAt?.durationAgo),
      summary:`Mark "${entity.title}" as watching${occurredOn?' from '+occurredOn:''}.`,
      operation:{
        kind:'UPDATE_MEDIA',
        entity,
        patch:{watchStatus:'WATCHING',startedOn:occurredOn??null},
        occurredOn,
      },
      source:fact,
    };
  }

  const p=percent(fact);
  if(fact.event==='PROGRESSED'&&p!==undefined){
    return {
      status:'READY',
      requiresConfirmation:approximate,
      summary:`Set "${entity.title}" watch progress to ${p}%.`,
      operation:{
        kind:'UPDATE_MEDIA',
        entity,
        patch:{progress:p,watchStatus:p>=100?'COMPLETED':'WATCHING'},
        occurredOn,
      },
      source:fact,
    };
  }

  if(fact.progress?.kind==='DURATION_MINUTES'){
    return {
      status:'UNSUPPORTED',
      reason:'A duration statement needs a session/backfill adapter; refusing to convert minutes into percentage.',
      source:fact,
    };
  }

  return {status:'UNSUPPORTED',reason:'No safe media-domain mapping for this fact.',source:fact};
}
