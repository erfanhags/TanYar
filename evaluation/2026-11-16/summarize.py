import collections,json,math,statistics
from pathlib import Path
ROOT=Path(__file__).resolve().parent
r=json.loads((ROOT/'results.json').read_text(encoding='utf-8'))
m=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))

def metrics(samples,provider='onnx'):
    n=len(samples)
    correct=sum(bool(s[provider]['results']) and s[provider]['results'][0]['id']==s['expected'] and not s[provider]['isNonFood'] for s in samples)
    offered=sum(any(v['id']==s['expected'] for v in s[provider]['results']) and not s[provider]['isNonFood'] for s in samples)
    high=[s for s in samples if s[provider]['results'] and s[provider]['results'][0]['confidence']>=.8]
    high_wrong=sum(s[provider]['results'][0]['id']!=s['expected'] for s in high)
    p=correct/n; z=1.96; den=1+z*z/n
    mid=(p+z*z/(2*n))/den;half=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den
    return dict(n=n,correct=correct,top1=correct/n,offered_hit=offered/n,rejected=sum(s[provider]['isNonFood'] for s in samples),mean_display_confidence=statistics.mean(s[provider]['results'][0]['confidence'] if s[provider]['results'] else 0 for s in samples),high_confidence_n=len(high),high_confidence_wrong=high_wrong,nominal_wilson95=[mid-half,mid+half])

summary={}
for group in ['food','fruit','all']:
    samples=[s for s in r['samples'] if group=='all' or s['group']==group]
    summary[group]={p:metrics(samples,p) for p in ['onnx','heuristic']}
summary['classes']={label:metrics([s for s in r['samples'] if s['label']==label]) for label in sorted(set(s['label'] for s in r['samples']))}
timings=sorted(s['onnx']['inferenceMs'] for s in r['samples'])
summary['timing']={'median_inference_ms':statistics.median(timings),'p95_inference_ms':timings[math.ceil(.95*len(timings))-1],'median_end_to_end_ms':statistics.median(s['onnx']['wallMs'] for s in r['samples'])}
summary['diagnostics']={p:{'n':len(r['diagnostics']),'rejected':sum(s[p]['isNonFood'] for s in r['diagnostics'])} for p in ['onnx','heuristic']}
counts=collections.Counter(s['sha256'] for s in m['samples'])
summary['exact_duplicates']={k:v for k,v in counts.items() if v>1}
seen=set(); unique=[]
for s in r['samples']:
    if s['sha256'] not in seen:unique.append(s);seen.add(s['sha256'])
summary['unique_all']=metrics(unique)
summary['wrong_predictions']=[{'id':s['id'],'expected':s['expected'],'predicted':s['onnx']['results'][0] if s['onnx']['results'] else None} for s in r['samples'] if not s['onnx']['results'] or s['onnx']['results'][0]['id']!=s['expected']]
(ROOT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in summary.items() if k!='wrong_predictions'},ensure_ascii=True,indent=2))
