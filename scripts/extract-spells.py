"""Extract the supplied Races-Classes PDF in column reading order; do not add rules."""
import argparse,hashlib,json,re,unicodedata
from pathlib import Path
import fitz

def norm(text):
 return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFD',text.lower()).encode('ascii','ignore').decode())
def ordered_lines(page, columns):
 lines=[]
 for block in page.get_text('dict')['blocks']:
  for line in block.get('lines',[]):
   if not 34<line['bbox'][1]<800:continue
   text=''.join(s['text'] for s in line['spans']).strip()
   if not text:continue
   x=line['bbox'][0];col=sum(x>=edge for edge in columns)
   lines.append({'text':text,'x':x,'y':line['bbox'][1],'col':col,'table':any(s['font'].startswith('Calibri') for s in line['spans']),'heading':any(s['font']=='Cambria-Bold' and 11.9<s['size']<12.1 and s['text'].strip() for s in line['spans'])})
 # Same-baseline table cells must read left to right rather than as independent paragraphs.
 groups={}
 for line in sorted(lines,key=lambda l:(l['col'],round(l['y'],1),l['x'])):
  key=(line['col'],round(line['y']/2)*2)
  if key in groups and not line['heading'] and not groups[key]['heading']:
   groups[key]['text']+=(' | ' if line['table'] and groups[key]['table'] else ' ')+line['text']
  else:groups[key]=line
 return sorted(groups.values(),key=lambda l:(l['col'],l['y'],l['x']))

def main():
 a=argparse.ArgumentParser();a.add_argument('pdf');a.add_argument('--output',default='assets/spells-fr.json');a.add_argument('--license-output',default='assets/spells-source-notice.txt');args=a.parse_args();pdf=fitz.open(args.pdf)
 index={};current_class=None;level=None
 for n in range(39,44):
  for line in ordered_lines(pdf[n],[210,387]):
   t=line['text']
   if t.startswith('SORTS DE ') or t.startswith('SORTS D’'):current_class=t.replace('SORTS DE ','').replace('SORTS D’','');level=None;continue
   if t.startswith('Sorts mineurs'):level=0;continue
   m=re.fullmatch(r'Niveau (\d)',t)
   if m:level=int(m[1]);continue
   if not current_class or level is None or t.startswith('*') or 'WWW.AIDEDD' in t or t.isdigit():continue
   if t=='SORTS':continue
   index.setdefault(norm(t.replace('*','')),[]).append({'class':current_class,'level':level,'page':n+1,'name':t.replace('*','').strip()})
 records=[];current=None;previous=None
 for n in range(44,len(pdf)):
  for line in ordered_lines(pdf[n],[300]):
   t=line['text']
   if line['table']:
    t=t.replace('Taille PV |','Taille | PV |').replace('Familiarité | Incident Zone similaire Hors cible Sur la cible','Familiarité | Incident | Zone similaire | Hors cible | Sur la cible')
    t=re.sub(r'^(TP|TG|P|M|G) (\d+) (\d+) \|',r'\1 | \2 | \3 |',t)
    t=re.sub(r'^(TP|TG|P|M|G) \| (\d+) (\d+) \|',r'\1 | \2 | \3 |',t)
   if t=='DESCRIPTION DES SORTS':continue
   if line['heading']:
    current={'id':'spell-'+str(len(records)+1),'name':t,'sourcePages':[n+1],'paragraphs':[],'levelSchool':'','_last':None,'_source':[]};records.append(current);previous=None;continue
   if current is None:continue
   current['_source'].append(t)
   if n+1 not in current['sourcePages']:current['sourcePages'].append(n+1)
   if not current['levelSchool']:
    current['levelSchool']=t;previous={**line,'page':n+1};continue
   meta=bool(re.match(r'^(Temps d[’\']incantation|Portée|Composantes|Durée)\s*:',t))
   gap=line['y']-previous['y'] if previous and previous['col']==line['col'] and previous['page']==n+1 else None
   newpara=not current['paragraphs'] or meta or line['table'] or (previous and previous.get('table')) or (gap is not None and gap>12.8)
   if newpara:current['paragraphs'].append(t)
   else:
    last=current['paragraphs'][-1]
    if last.endswith('-'):current['paragraphs'][-1]=last+t
    else:current['paragraphs'][-1]+=' '+t
   previous={**line,'page':n+1}
 aliases={'signaldesperance':'lueurdespoir','rayondaffaiblissement':'rayonaffaiblissant'}
 for alias,canonical in aliases.items():
  index.setdefault(canonical,[]).extend(index.get(alias,[]))
 for record in records:
  compact=lambda text:re.sub(r'[\s|]+','',text)
  assert compact(''.join(record['_source']))==compact(record['levelSchool']+''.join(record['paragraphs'])),record['name']
  record.pop('_source');record.pop('_last');record['aliases']=[m['name'] for alias,canonical in aliases.items() if canonical==norm(record['name']) for m in index[alias]];record['classes']=sorted({m['class'] for m in index.get(norm(record['name']),[])})
  record['level']=0 if 'niveau 0' in record['levelSchool'] else int(re.search(r'niveau\s+(\d)',record['levelSchool'])[1])
  assert record['paragraphs'] and all(any(re.match(pattern,p) for p in record['paragraphs']) for pattern in [r'Temps d[’\']incantation',r'Portée',r'Composantes',r'Durée']),record['name']
 assert len(records)==330 and len({norm(r['name']) for r in records})==330
 names={norm(r['name']) for r in records};missing={k:v for k,v in index.items() if k not in names}
 print('Descriptions:',len(records),'Listed spell names:',len(index),'Names only in lists:',missing)
 data={'format':'fdc-spell-reference','version':1,'source':{'file':'Races-Classes.pdf','title':'Races, Classes et Sorts D&D 5','credit':'Traduction communautaire AideDD — Blueace','sha256':hashlib.sha256(Path(args.pdf).read_bytes()).hexdigest(),'listsStartPage':40,'descriptionStartPage':45,'endPage':113},'spells':records}
 out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 notice=pdf[1].get_text('text',clip=fitz.Rect(0,0,300,800))+'\n'+pdf[1].get_text('text',clip=fitz.Rect(300,0,595,800));Path(args.license_output).write_text(notice)
 print('JSON bytes:',out.stat().st_size)
 for name in ['ALARME','BOULE DE FEU','ANIMATION D’OBJETS','ZONE DE VÉRITÉ']:
  r=next(r for r in records if r['name']==name);print('\n',r['name'],r['levelSchool'],r['classes'],r['sourcePages'],'\n','\n\n'.join(r['paragraphs'])[:900])
if __name__=='__main__':main()
