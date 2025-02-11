/**
 * @files 初始化 st 对象的方法
 */
import Vue from 'vue';
import storage from 'chrome-storage-wrapper';
import interact from 'interact.js';
import createST from 'selection-widget';

import template from './tpl.html';

// 将 interact 注册在全局对象上,这样 ST 初始化时就能读取到了
window.interact = interact;

const initST = async ()=> {
  let defApi = '';
  const {runtime} = chrome ,
    {host} = location ,
    storageKeys = [
      'ignoreChinese' , 'ignoreNumLike' , 'showBtn' ,
      'needCtrl' , 'defaultApi' , 'excludeDomains'
    ] ,
    options = await storage.get( storageKeys );

  const st = new Vue( createST( {
    template ,
    btn : '.st-btn' ,
    box : '.st-box' ,
    drag : 'header' ,
    getResult() {
      if ( !this.boxPos.show && defApi ) {
        this.query.api = defApi;
      }
      return send( {
        action : 'translate' ,
        data : this.query
      } )
        .catch( error => ({ error }) )
        .then( resultObj => this.result = resultObj );
    } ,
    mixins : [
      {
        data : ()=>({
          query : {
            api : options.defaultApi ,
            from : '' ,
            to : ''
          } ,
          result : {
            phonetic : '' ,
            detailed : [] ,
            result : '' ,
            linkToResult : '' ,
            response : {} ,
            api : {
              name : ''
            }
          }
        }) ,
        methods : {

          /**
           * 打开设置页
           */
          openOptions() {
            send( {
              action : 'openTab' ,
              data : {
                url : 'options/index.html'
              }
            } );
          } ,

          /**
           * 复制文本
           * @param {String|String[]} textOrTextArray
           */
          copy( textOrTextArray ) {
            if ( Array.isArray( textOrTextArray ) ) {
              textOrTextArray = textOrTextArray.join( '\n' );
            }
            send( {
              action : 'copy' ,
              data : textOrTextArray
            } );
          } ,

          /**
           * 播放语音
           * @param {String|String[]} textOrTextArray
           * @param {Boolean} [isFrom] - 默认情况下会读取 result.to 作为语音的语种,若这个值为 true 则使用 result.from
           */
          play( textOrTextArray , isFrom ) {
            if ( Array.isArray( textOrTextArray ) ) {
              textOrTextArray = textOrTextArray.join( '\n' );
            }
            send( {
              action : 'play' ,
              data : {
                text : textOrTextArray ,
                api : this.result.api.id ,
                from : this.result[ isFrom ? 'from' : 'to' ]
              }
            } );
          }
        }
      }
    ]
  } ) );

  st.$appendTo( 'body' );

  storageChanged( options );

  // 在设置变更时保持同步
  storage.addChangeListener( storageChanged , { keys : storageKeys } );

  return st;

  /**
   * 处理设置变化
   * @param {StorageData} items
   */
  function storageChanged( items ) {
    const {defaultApi,excludeDomains} = items;

    if ( excludeDomains ) {
      st.selection = !excludeDomains.some( domain => domain === host );
      delete items.excludeDomains;
    }

    if ( defaultApi ) {
      defApi = defaultApi;
      delete items.defaultApi;
    }

    Object.assign( st , items );
  }

  /**
   * 传递消息到后台的方法
   * @param {Object} obj
   * @returns {Promise}
   */
  function send( obj ) {
    return new Promise( ( resolve , reject )=> {
      try { // 连接到背景页时可能会报错：{ message : 'Error connecting to extension ${扩展id}' }
        runtime.sendMessage( obj , res => {
          const le = runtime.lastError;
          if ( le || !res ) { // 不知道为何，偶尔res会是一个undefined
            reject( '获取查询结果时发生了错误，请尝试刷新网页或重启浏览器后重试。' , le );
          } else {
            resolve( res );
          }
        } );
      }
      catch ( e ) {
        reject( '连接到翻译引擎时发生了错误，请尝试刷新网页或重启浏览器后重试。' , e );
      }
    } );
  }
};

let p;
export default ()=> p || (p = initST());
