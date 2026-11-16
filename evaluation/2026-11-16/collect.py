"""Fixed-seed public-image sample, chosen before model inference; no training."""
import concurrent.futures as cf
import hashlib, json, random, sys, time, urllib.request, urllib.parse, urllib.error
from pathlib import Path
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parent
(ROOT/'images').mkdir(exist_ok=True)
(ROOT/'metadata').mkdir(exist_ok=True)
SEED=20261116
FOODS={'chocolate_cake':'sf_cake','french_fries':'sf_fries','greek_salad':'sf_salad','grilled_salmon':'sf_fish','hamburger':'sf_burger','ice_cream':'sf_icecream','omelette':'sf_egg','pizza':'sf_pizza','spaghetti_bolognese':'sf_pasta','steak':'sf_beef'}

def request(url):
    for attempt in range(7):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'TanYar-model-evaluation/1.0'}),timeout=50) as r:return r.read()
        except Exception as e:
            if attempt==6: raise
            time.sleep(25 if isinstance(e,urllib.error.HTTPError) and e.code==429 else 2+attempt)

def rows(offset,length=100):
    p=ROOT/'metadata'/f'food101_{offset}_{length}.json'
    if not p.exists():
        url='https://datasets-server.huggingface.co/rows?'+urllib.parse.urlencode(dict(dataset='ethz/food101',config='default',split='validation',offset=offset,length=length))
        p.write_bytes(request(url))
    return json.loads(p.read_text())

def download(item):
    p=ROOT/'images'/f"{item['id']}.jpg"
    if not p.exists():p.write_bytes(request(item['url']))
    with Image.open(p) as im:
        im.load();item['width'],item['height']=im.size
    item['path']=str(p.relative_to(ROOT)).replace('\\','/')
    item['sha256']=hashlib.sha256(p.read_bytes()).hexdigest()
    return item

def main():
    rng=random.Random(SEED)
    # The hosted split is grouped in 250-row blocks, in non-alphabetical order.
    blocks={}
    for p in (ROOT/'metadata').glob('food101*.json'):
        j=json.loads(p.read_text())
        names=next(f['type']['names'] for f in j['features'] if f['name']=='label')
        for r in j['rows']:blocks[names[r['row']['label']]]=r['row_idx']//250*250
    for offset in range(0,25250,250):
        if offset not in blocks.values():
            j=rows(offset,1)
            names=next(f['type']['names'] for f in j['features'] if f['name']=='label')
            r=j['rows'][0];blocks[names[r['row']['label']]]=r['row_idx']
            time.sleep(1)
    print('class blocks located',len(blocks),flush=True)
    offsets=[blocks[k]+delta for k in FOODS for delta in (0,100,200)]
    pool={k:[] for k in FOODS}
    with cf.ThreadPoolExecutor(max_workers=2) as ex:
        for j in ex.map(rows,offsets):
            names=next(f['type']['names'] for f in j['features'] if f['name']=='label')
            for r in j['rows']:
                label=names[r['row']['label']]
                if label in pool and all(old['row_idx']!=r['row_idx'] for old in pool[label]):pool[label].append(r)
    items=[]
    for label,target in FOODS.items():
        selected=rng.sample(sorted(pool[label],key=lambda r:r['row_idx']),20)
        print('selected',label,len(selected),'from',len(pool[label]),flush=True)
        for r in selected:
            items.append(dict(id=f"food101_{r['row_idx']}",group='food',label=label,expected=target,dataset='ethz/food101',split='validation',row_idx=r['row_idx'],url=r['row']['image']['src']))
    repo=json.loads(request('https://huggingface.co/api/datasets/sirunchained/fruit-dataset'))
    revision=repo['sha']
    for label,target in {'apple':'sf_apple','avocado':'sf_avocado','banana':'sf_banana','grape':'sf_grapes'}.items():
        for idx in range(30):
            source=f'data/{label}/{label}_{idx:04d}.jpg'
            items.append(dict(id=f'fruit_{label}_{idx:04d}',group='fruit',label=label,expected=target,dataset='sirunchained/fruit-dataset',revision=revision,source_path=source,url=f'https://huggingface.co/datasets/sirunchained/fruit-dataset/resolve/{revision}/{source}'))
    results=[]; failures=[]
    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        futures={ex.submit(download,item):item for item in items}
        for f in cf.as_completed(futures):
            try:results.append(f.result())
            except Exception as e: failures.append(dict(id=futures[f]['id'],error=str(e)))
            if (len(results)+len(failures))%40==0:print('downloaded',len(results),'failures',len(failures),flush=True)
    results.sort(key=lambda x:x['id'])
    manifest=dict(seed=SEED,selection='20 random images per preselected food class from all 250 validation images, after verifying the hosted class blocks. All 30 available images for each of four supported fruit classes. No selection based on predictions.',food_offsets=offsets,samples=results,failures=failures)
    (ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print('COMPLETE',len(results),'failures',failures,flush=True)
    if failures:sys.exit(1)

if __name__=='__main__':main()
