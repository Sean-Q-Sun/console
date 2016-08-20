'use strict';

const types = {
  watchK8sObject: 'watchK8sObject',
  watchK8sList: 'watchK8sList',
  stopK8sWatch: 'stopK8sWatch',

  loaded: 'loaded',
  errored: 'errored',

  modifyObject: 'modifyObject',

  addToList: 'addToList',
  deleteFromList: 'deleteFromList',
  modifyList: 'modifyList',
  filterList: 'filterList',

};

const action_ = (type) => {
  return (id, k8sObjects) => ({type, id, k8sObjects});
}

const WS = {};
const POLLs = {};
const REF_COUNTS = {};

const nop = () => {};

const actions =  {
  [types.deleteFromList]: action_(types.deleteFromList),
  [types.addToList]: action_(types.addToList),
  [types.modifyList]: action_(types.modifyList),
  [types.loaded]: action_(types.loaded),
  [types.errored]: action_(types.errored),
  [types.modifyObject]: action_(types.modifyObject),

  filterList: (id, name, value) => {
    return {id, name, value, type: types.filterList};
  },

  watchK8sObject: (id, name, namespace, k8sType) => dispatch => {
    if (id in REF_COUNTS) {
      REF_COUNTS[id] += 1;
      return nop;
    }
    dispatch({id, type: types.watchK8sObject});
    REF_COUNTS[id] += 1;

    const poller = () => {
      k8sType.get(name, namespace)
        .then(o => dispatch(actions.modifyObject(id, o)))
        .catch(e => dispatch(actions.errored(id, e)));
    };
    POLLs[id] = setInterval(poller, 10 * 1000);
    poller();
  },

  stopK8sWatch: id => {
    REF_COUNTS[id] -= 1;
    if (REF_COUNTS[id] >= 1) {
      return nop;
    }

    const ws = WS[id];
    if (ws) {
      ws.destroy();
      delete WS[id];
    }
    const poller = POLLs[id];
    clearInterval(poller);
    delete POLLs[id];
    delete REF_COUNTS[id];
    return {type: types.stopK8sWatch, id};
  },
  watchK8sList: (id, query, k8sType) => dispatch => {
    if (id in REF_COUNTS) {
      REF_COUNTS[id] += 1;
      return nop;
    }

    dispatch({type: types.watchK8sList, id, query});
    REF_COUNTS[id] = 1;

    const ws = k8sType.watch(query).onmessage(msg => {
      let theAction;
      switch (msg.type) {
        case 'ADDED':
          theAction = actions.addToList;
          break;
        case 'MODIFIED':
          theAction = actions.modifyList;
          break;
        case 'DELETED':
          theAction = actions.deleteFromList;
          break;
        default:
          return;
      }
      dispatch(theAction(id, msg.object));
    });

    WS[id] = ws;

    const poller = () => {
      k8sType.list(_.clone(query, true))
        .then(o => dispatch(actions.loaded(id, o)))
        .catch(e => dispatch(actions.errored(id, e)));
    };
    POLLs[id] = setInterval(poller, 30 * 1000);
    poller();
  },
};

export {types};
export default actions;