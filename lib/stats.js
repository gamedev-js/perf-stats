import Graph from './graph';
import StackGraph from './stack-graph';
import PerfCounter from './perf-counter';

let _canvasWidth = 100;
let _canvasHeight = 10;
let _css = `
  .pstats {
    position: absolute;
    z-index: 9999;

    padding: 5px;
    width: ${_canvasWidth+150}px;
    right: 0;
    bottom: 0;

    font-size: 10px;
    font-family: 'Roboto Condensed', tahoma, sans-serif;
    overflow: hidden;
    user-select: none;
    cursor: default;

    background: rgba(0,0,0,0.2);
    border-radius: 3px;

  }

  .pstats-container {
    display: flex;
    flex-direction: column;
    color: #888;
  }

  .pstats-item {
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  .pstats-label {
    display: flex;
    flex-direction: row;
    flex: 1;

    text-align: left;
    margin-right: 5px;

    transition: background 0.3s;
  }

  .pstats-label.alarm {
    color: #ccc;
    background: #800;

    transition: background 0s;
  }

  .pstats-counter-id {
    flex: 1;
  }

  .pstats-counter-value {
    width: 30px;
    text-align: right;
  }

  .pstats-fraction {
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  .pstats-legend {
    display: flex;
    flex-direction: column;
    flex: 1;

    text-align: right;
    margin-right: 5px;
  }
`;

// DISABLE:
// let cssFont = 'https://fonts.googleapis.com/css?family=Roboto+Condensed:400,700,300';
// let cssFontEL = document.createElement('link');
// cssFontEL.href = cssFont;
// cssFontEL.rel = 'stylesheet';
// cssFontEL.type = 'text/css';
// document.head.appendChild(cssFontEL);

// add global style
let styleEL = document.createElement('style');
styleEL.type = 'text/css';
styleEL.textContent = _css;
document.head.appendChild(styleEL);

//
export default class Stats {
  constructor (dom, opts) {
    opts = opts || {};
    this._colors = opts.colors || ['#850700', '#c74900', '#fcb300', '#284280', '#4c7c0c'];
    this._values = opts.values || {};
    this._fractions = opts.fractions || [];
    this._id2perf = {};
    this._id2item = {};

    if (opts.css) {
      let styleEL = document.createElement('style');
      styleEL.type = 'text/css';
      styleEL.textContent = opts.css;
      document.head.appendChild(styleEL);
    }

    // TODO
    // if (opts.plugins) {
    //   if (!opts.values) opts.values = {};
    //   if (!opts.groups) opts.groups = [];
    //   if (!opts.fractions) opts.fractions = [];
    //   for (let j = 0; j < opts.plugins.length; j++) {
    //     opts.plugins[j].attach(_perf);
    //     iterateKeys(opts.plugins[j].values, function (k) {
    //       opts.values[k] = opts.plugins[j].values[k];
    //     });
    //     opts.groups = opts.groups.concat(opts.plugins[j].groups);
    //     opts.fractions = opts.fractions.concat(opts.plugins[j].fractions);
    //   }
    // } else {
    //   opts.plugins = {};
    // }

    // TODO
    // if (opts.groups) {
    //   iterateKeys(opts.groups, function (j) {
    //     let g = opts.groups[parseInt(j, 10)];
    //     let div = document.createElement('div');
    //     div.className = 'rs-group';
    //     g.div = div;
    //     let h1 = document.createElement('h1');
    //     h1.textContent = g.caption;
    //     h1.addEventListener('click', function (e) {
    //       this.classList.toggle('hidden');
    //       e.preventDefault();
    //     }.bind(div));
    //     div.appendChild(h1);
    //     div.appendChild(div);
    //   });
    // }

    // ==================
    // DOM
    // ==================

    this._root = document.createElement('div');
    this._root.className = 'pstats';

    let containerEL = document.createElement('div');
    containerEL.className = 'pstats-container';

    this._root.appendChild(containerEL);

    // pstats-item
    for (let id in this._values) {
      let vopts = this._values[id];

      // .pstats-item
      let itemEL = document.createElement('div');
      itemEL.className = 'pstats-item';

      // .pstats-label
      let label = document.createElement('div');
      label.className = 'pstats-label';

      let spanId = document.createElement('span');
      spanId.className = 'pstats-counter-id';
      spanId.textContent = vopts.desc || id;

      let spanValue = document.createElement('div');
      spanValue.className = 'pstats-counter-value';

      let spanValueText = document.createTextNode('');
      spanValueText.nodeValue = '0';

      label.appendChild(spanId);
      label.appendChild(spanValue);
      spanValue.appendChild(spanValueText);
      itemEL.appendChild(label);

      // graph
      let graph = new Graph(itemEL, vopts.color);
      graph.init(_canvasWidth, _canvasHeight);

      //
      this._id2item[id] = {
        label: label,
        valueText: spanValueText,
        graph,
      };

      containerEL.appendChild(itemEL);
    }

    // pstats-fraction
    if (opts.fractions) {
      for ( let i = 0; i < opts.fractions.length; ++i ) {
        let fraction = opts.fractions[i];

        let fractionEL = document.createElement('div');
        fractionEL.className = 'pstats-fraction';

        let legend = document.createElement('div');
        legend.className = 'pstats-legend';

        let steps = fraction.steps;
        for (let h = 0; h < steps.length; ++h) {
          let p = document.createElement('span');
          p.textContent = steps[h];
          p.style.color = this._colors[h];
          legend.appendChild(p);
        }

        fractionEL.appendChild(legend);
        fractionEL.style.height = steps.length * _canvasHeight + 'px';
        fraction.dom = fractionEL;

        let graph = new StackGraph(fractionEL, this._colors);
        graph.init(_canvasWidth, _canvasHeight, steps.length);

        fraction.graph = graph;

        containerEL.appendChild(fractionEL);
      }
    }

    dom.appendChild(this._root);
  }

  item(id) {
    if (!id) {
      return null;
    }

    id = id.toLowerCase();
    let perf = this._id2perf[id];
    if (perf) {
      return perf;
    }

    // TODO:
    // let group = null;
    // if (this._opts && this._opts.groups) {
    //   iterateKeys(this._opts.groups, function (j) {
    //     let g = this._opts.groups[parseInt(j, 10)];
    //     if (!group && g.values.indexOf(id.toLowerCase()) !== -1) {
    //       group = g;
    //     }
    //   });
    // }

    let vopts = this._values[id];
    perf = new PerfCounter(id, vopts);
    this._id2perf[id] = perf;

    return perf;
  }

  tick() {
    for (let id in this._values) {
      let perf = this._id2perf[id];
      if (perf) {
        let av = perf.sampleAverage();
        let alarm = perf.sampleAlarm();
        let item = this._id2item[id];

        item.label.classList.toggle('alarm', alarm > 0);
        item.valueText.nodeValue = av;
        item.graph.draw(perf.value, alarm);
      }
    }

    // fractions
    for ( let i = 0; i < this._fractions.length; ++i ) {
      let fraction = this._fractions[i];
      let v = [];

      let perfBase = this._id2perf[fraction.base.toLowerCase()];
      if (perfBase) {
        let steps = fraction.steps;
        for (let j = 0; j < steps.length; ++j) {
          let id = steps[j].toLowerCase();
          let perf = this._id2perf[id];
          if (perf) {
            v.push(perf.value / perfBase.value);
          }
        }
        fraction.graph.draw(v);
      }
    }

    // TODO:
    // iterateKeys(this._opts.plugins, function (j) {
    //   this._opts.plugins[j].update();
    // });
  }
}