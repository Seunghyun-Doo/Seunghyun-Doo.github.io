const customerJourney=(function (){

    let idxForTriggerElem = 1;
    let _100vh = get100VhSize();
    let onScrollAnimationInfos = [];
    let animationElements = {};
    let customFunctionList = [];

   function loadElementsToAnimate(onScroll){
      const aniElems = [...document.querySelectorAll('*')].filter(elem=>{
         return elem.getAttributeNames().filter(attr=>attr.indexOf('data-animation')>-1)
             .length>0;
      });

      const aniOnLoadElems = aniElems.filter(elem=>
          elem.dataset.animationType !== undefined
         && elem.dataset.animationType.toLowerCase() === 'onload');
      const aniOnScrollElems = aniElems.filter(elem=>
          elem.dataset.animationType !== undefined
          && elem.dataset.animationType.toLowerCase() === 'onscroll');

      initCustomFunctions();
      setElemsAniOnLoad(aniOnLoadElems);
      setElemsAniOnScroll(aniOnScrollElems);
   }

   function setElemsAniOnLoad(elems) {
       if(elems===undefined){
           elems = [...document.querySelectorAll('*')].filter(elem=>
               elem.getAttributeNames().filter(attr=>attr.toLowerCase().indexOf('data-animation-type')>-1).length>0
               && elem.dataset.animationType==='onload'
           );
       }
       if(customFunctionList.length===0)
           initCustomFunctions();
      elems.forEach(elem=>{
        let animationInfos = extractAnimationInfos(elem);
        for(let animationInfo of animationInfos) {
            if (animationInfo.stylePropsBefore !== undefined)
                animationInfo.stylePropsBefore.applyStyles();

            setTimeout(() => {
                elem.style.transitionDuration = animationInfo.transitionDuration;
                elem.style.transitionProperty = animationInfo.props.filter(e => e != null && e.trim() !== '').toString();

                if (animationInfo.stylePropsAfter !== undefined)
                    animationInfo.stylePropsAfter.applyStyles();
                if (animationInfo.addClassNm !== undefined)
                    elem.classList.add(animationInfo.addClassNm);
                if (animationInfo.removeClassNm !== undefined)
                    elem.classList.remove(animationInfo.removeClassNm);
            }, animationInfo.startMs);
        }
      });
   }

   function setElemsAniOnScroll(elems){
       if(elems===undefined){
           animationElements={};
           elems = [...document.querySelectorAll('*')].filter(elem=>
               elem.getAttributeNames().filter(attr=>attr.toLowerCase().indexOf('data-animation-type')>-1).length>0
               && elem.dataset.animationType==='onscroll'
           );
       }
       if(customFunctionList.length===0)
           initCustomFunctions();
       elems.forEach(elem=>{
           let animationInfos = extractAnimationInfos(elem);
           for(let animationInfo of animationInfos) {
               onScrollAnimationInfos.push(animationInfo);

               if (animationInfo.stylePropsBefore !== undefined)
                   animationInfo.stylePropsBefore.applyStyles();

               if(animationInfo.stylePropsAfter !== undefined
               && animationInfo.isTriggered() && animationInfo.getProgress()===1)
                   animationInfo.stylePropsAfter.applyStyles();
           }
       });

       window.addEventListener('scroll',testOuter);
       onScrollProcessor();
       history.scrollRestoration='manual';
   }

   function onScrollProcessor(){
       onScrollAnimationInfos.filter(e=>e.isInPlayingArea()).forEach(animationsInfo=>{
           if(animationsInfo.stylePropsAfter!==undefined){
               animationsInfo.stylePropsAfter.props.forEach(prop => {
                   const calcValue = getAnimatedDigitValue(animationsInfo, prop, animationsInfo.getProgress());
                   const styleStr = animationsInfo.stylePropsAfter[prop].propNmPreFix
                       + calcValue
                       + animationsInfo.stylePropsAfter[prop].propNmSuffix;

                   //동일한 엘레먼트에서 중복된 애니메이션 속성이 이미 적용된 경우 이어붙이기
                   if(isDuplicatedProp(prop, animationsInfo))
                       animationsInfo.targetElement.style[prop] = animationsInfo.targetElement.style[prop]+styleStr;
                   else
                       animationsInfo.targetElement.style[prop] = styleStr;
               });
           }
       });

       function getAnimatedDigitValue(animationsInfo, propNm, progress){
           const {stylePropsBefore, stylePropsAfter} = animationsInfo;
           const stylePropBefore = stylePropsBefore[propNm];
           const stylePropAfter = stylePropsAfter[propNm];
           if(stylePropAfter.hexColor!==undefined){
               let clone = {...stylePropBefore.hexColor};
               clone.red = Math.round(calculate(stylePropBefore.hexColor.red, stylePropAfter.hexColor.red, progress));
               clone.green = Math.round(calculate(stylePropBefore.hexColor.green, stylePropAfter.hexColor.green, progress));
               clone.blue = Math.round(calculate(stylePropBefore.hexColor.blue, stylePropAfter.hexColor.blue, progress));
               return clone.toHexString();
           }else{
               return calculate(stylePropBefore.propDigitValue, stylePropAfter.propDigitValue, progress);
           }
       }

       function calculate(fromValue, toValue, progress){
           return Math.round((fromValue + (toValue - fromValue) * progress) * 100) / 100;
       }

       function isDuplicatedProp(prop, animationsInfo){
           if(animationElements[animationsInfo.elementId].length===1)
               return false;
           const currIdx = animationElements[animationsInfo.elementId].findIndex(info=>info===animationsInfo);
           //현재 animationInfo 의 인덱스보다 이전 animationInfo가 존재하면서,
           //동일한 prop을 가진 경우 중복 prop임
           return animationElements[animationsInfo.elementId].filter(
               (info, idx) => idx < currIdx && info.props.filter(p => p === prop).length > 0
           ).length > 0;
       }
   }
    let isExecuting = false;
    function testOuter(animationInfos, progress, targetElement){

        let testInner = function() {
            isExecuting = true;
            onScrollProcessor();
            isExecuting = false;
        }

        if(isExecuting)
            return;
        requestAnimationFrame(testInner);
    }

   function extractAnimationInfos(elem){
       const animationType = elem.dataset.animationType.toLowerCase();
       const infos = getAniInfosFromString(elem.dataset.animationInfos);
       let result=[];
       for(let info of infos) {
           let {
               'style-bf-ani': styleStrBefore, 'style-af-ani': styleStrAfter,
               'start-ms': startMs,
               'transition-duration': transitionDuration = '0.3s', 'transition-props': props,
               'add-class-nm': addClassNm, 'remove-class-nm': removeClassNm,
               'trigger-element': triggerElement, 'trigger-hook': triggerHook = 0.75,
               'onscroll-declared-animation-types': onScrollDeclaredAnimationTypes,
               'scroll-duration': scrollDuration = 200
           } = info;

           let stylePropsBefore = convertStyleStr2Obj(styleStrBefore, elem);
           let stylePropsAfter = convertStyleStr2Obj(styleStrAfter, elem);
           props = (props || '').replace(/[\'\"\[\]]/g, '').split(',');

           if (stylePropsAfter !== undefined) {
               props = [...props, ...stylePropsAfter.props
                   .map(e => stylePropsAfter[e].kebabCasePropNm)
                   .filter(e => !props.includes(e))];
           }

           if(elem.dataset.elementId===undefined) {
               elem.dataset.elementId = `scrollAnimationElem#${idxForTriggerElem}`;
               idxForTriggerElem++;
           }
           if (triggerElement === undefined)
               triggerElement = `[data-element-id='${elem.dataset.elementId}']`;

           const obj= {targetElement:elem
               , animationType
               , elementId : elem.dataset.elementId
               , stylePropsBefore
               , stylePropsAfter
               , startMs
               , transitionDuration
               , props: props.filter(e => e != null && e.trim() !== '')
               , addClassNm
               , removeClassNm
               , triggerElement
               , triggerHook
               , isTriggered() {
                   return window.scrollY+(_100vh*this.triggerHook) > this.triggerElementOffsetTop();
               }
               , isInPlayingArea() {
                   const startPoint = window.scrollY+(_100vh*this.triggerHook);
                   const redrawAreaStartPoint = (this.triggerElementOffsetTop() - (_100vh * 0.2))
                   const redrawAreaEndPoint = Math.min((this.triggerElementOffsetTop() + this.scrollDuration + (_100vh * 0.2))
                       , window.scrollY+_100vh);
                   return startPoint > redrawAreaStartPoint
                       && startPoint < redrawAreaEndPoint;
               }
               , getProgress() {
                   let progress = 0;
                   if(!this.isTriggered())
                       return progress;

                   const curr = this.triggerElementOffsetTop()-window.scrollY;
                   const target = _100vh*triggerHook-this.scrollDuration;
                   return Math.min(1 + Math.round((target-curr)/scrollDuration*100)/100,1);
               }
               , triggerElementOffsetTop(){
                   let sumHeight = 0;
                   let elem = this.targetElement;

                   do{
                       sumHeight += elem.offsetTop;
                       elem = elem.offsetParent;
                   }while(elem!==null)

                   return sumHeight;
               }
               , onScrollDeclaredAnimationTypes : onScrollDeclaredAnimationTypes===undefined? undefined :
                   onScrollDeclaredAnimationTypes.split(';').map(str=>{
                       const prop = str.replace(/[\'\"\[\]]/g,'').split(':');
                       return {aniType : prop[0].trim()
                           , aniValues : prop[1].split(',').map(e=>e.trim())};
                   })
               , scrollDuration : Number(scrollDuration)
               , staticPositionLeft : Math.ceil(elem.getBoundingClientRect().x)
           };

           let aniInfos = animationElements[elem.dataset.elementId] || [];
           aniInfos.push(obj);
           animationElements[elem.dataset.elementId] = aniInfos;

           result.push(obj);
       }

       return result;


       function getAniInfosFromString(orgStr){
           let result=[];
           let animationInfoString = orgStr.replace(/\n/g,'');
           if(animationInfoString.match(/^\s*{.+}\s*$/)===null)
               animationInfoString = '{'+animationInfoString.trim()+'}';

           animationInfoString.match(/{.*?}/g).forEach(aniStr=> {
               let strings = aniStr.replace(/[{}]/g, '').match(/[^,\s]+?:\s*[\'\"].+?[\'\"]/g);
               let aniObj = {};

               strings.forEach(str => {
                   if (str === null || str.trim() === '')
                       return;
                   str = str.trim();
                   let propNm = str.match(/(.+?):/)[1];
                   let propValue = str.match(/:(.+)/)[1].replace(/[\'\"]/g, '').trim();
                   aniObj[propNm] = propValue;
               });

               if(Object.keys(aniObj).length>0)
                   result.push(aniObj);
           })
           return result;
       }
   }

   function convertStyleStr2Obj(styleStr, targetElement){
       if(styleStr === undefined)
           return undefined;

       let returnObj={props:[]};
       styleStr.replace(/[\'\"\[\]]/g,'').split(';').filter(str=>str.trim()!=='').forEach(stylePropStr=>{
           let [kebabCasePropNm, propValue] = stylePropStr.trim().split(':');
           let camelCasePropNm = kebabCasePropNm.replace(/-./g,a=>a.toUpperCase()).replace(/-/g,'');
           returnObj[camelCasePropNm] = {kebabCasePropNm:undefined, propValue:undefined
               , propDigitValue:undefined, propNmPreFix: undefined, propNmSuffix: undefined};
           returnObj[camelCasePropNm].kebabCasePropNm = kebabCasePropNm;
           propValue = convertFunctionValue(propValue,targetElement);
           returnObj[camelCasePropNm].propValue = propValue;

           const hexColor = propValue.match(/\#[a-zA-Z0-9]{6}(?=\s*)/);
           if(hexColor!==null){
               const hex = hexColor[0].replace("#",'');
               returnObj[camelCasePropNm].hexColor = {
                   red: (parseInt(hex,16)>>16) & 255
                   , green: (parseInt(hex,16)>>8) & 255
                   , blue: parseInt(hex,16) & 255
                   , toHexString() {
                       let str = '#';
                       str += this.red.toString(16);
                       str += this.green.toString(16);
                       str += this.blue.toString(16);
                       return str;
                   }
               }
               returnObj[camelCasePropNm].propNmPreFix='';
               returnObj[camelCasePropNm].propNmSuffix='';
           }else {
               const propPieces = propValue.match(/^(\D*?(?=-?\d))(-?[\d\.]*)(\D*)$/);
               if (propPieces !== null) {
                   returnObj[camelCasePropNm].propNmPreFix = propPieces[1];
                   returnObj[camelCasePropNm].propDigitValue = propPieces[2] !== '' ? Number(propPieces[2]) : '';
                   returnObj[camelCasePropNm].propNmSuffix = propPieces[3];
               }
           }

           returnObj[camelCasePropNm].toString = ()=>`${kebabCasePropNm}:${propValue};`;
           returnObj.props.push(camelCasePropNm);
       });
       returnObj.toString=function() {
           let printStr='';
           for(let propNm in this){
               printStr += this[propNm].toString();
           }
           return printStr;
       };
       returnObj.applyStyles=function(){
           this.props.forEach(camelCaseProp=> {
               const kebabCaseProp = camelCaseProp.replace(/[a-z][A-Z]/g,str=>str.charAt(0)+'-'+str.charAt(1).toLowerCase());
               const infoIdx = animationElements[targetElement.dataset.elementId]
                   .findIndex(aniInfo=>aniInfo.stylePropsBefore===this||aniInfo.stylePropsAfter===this);
               if(animationElements[targetElement.dataset.elementId].filter((info,idx)=>
                   idx<infoIdx &&
                   info.props.filter(prop=>prop===kebabCaseProp).length>0).length>0)
                   targetElement.style[camelCaseProp] = targetElement.style[camelCaseProp] + returnObj[camelCaseProp].propValue;
               else
                   targetElement.style[camelCaseProp] = returnObj[camelCaseProp].propValue;
           });
       }
       return returnObj;
   }

   function get100VhSize(){
       const div = document.createElement('div');
       div.style.height='100vh';
       div.style.position='fixed';

       document.querySelector('body').appendChild(div);
       const _100vh = div.clientHeight;
       div.remove();
       return _100vh;
   }

   function getOffsetTop(){
       let sumHeight = 0;
       let elem = this.targetElement;

       do{
           sumHeight += elem.offsetTop;
           elem = elem.offsetParent;
       }while(elem!==null)

       return sumHeight;
   }

   function initCustomFunctions(){
       customFunctionList = [
           {
               functionNm : 'getBrightnessAdjustedBgColor',
               functionRegex : /getBrightnessAdjustedBgColor\s*\(\s*[\d\.]+\s*\)/,
               getValue(str) {
                   const bgColor = getBackgroundColor();
                   const percent = Number(str.match(/[\d\.]+/));
                   const colorInfo = adjustBrightnessOfColor(bgColor.red, bgColor.green, bgColor.blue,percent);
                   return '#'+colorInfo.red.toString(16)+colorInfo.green.toString(16)+colorInfo.blue.toString(16);
               }
           },
           {
               functionNm : 'getOffsetLeftFromParent',
               functionRegex : /getOffsetLeftFromParent\s*\(.*\)/,
               getValue(str, targetElement) {
                   const offset = targetElement.offsetLeft - targetElement.parentElement.offsetLeft;
                   const suffix = str.match(/\([\s\'\"]*(.+?)[\s\'\"]*\)/);
                   return offset + (suffix!==null&&suffix.length>1? suffix[1]:'');
               }
           },
           {
               functionNm : 'getOffsetRightFromParent',
               functionRegex : /getOffsetRightFromParent\s*\(.*\)/,
               getValue(str, targetElement){
                   const offset = targetElement.parentElement.clientWidth - targetElement.offsetWidth;
                   const suffix = str.match(/\([\s\'\"]*(.+?)[\s\'\"]*\)/);
                   return offset + (suffix!==null&&suffix.length>1? suffix[1]:'');
               }
           },
           {
               /**
                * getOffsetFromLeftEdge
                * 스크린 왼쪽부터 요소의 왼쪽 면까지의 거리 계산
                * param1 : 접미어(단위)
                * param2 : 추가계산식
                */
               functionNm : 'getOffsetFromLeftEdge',
               functionRegex : /getOffsetFromLeftEdge\s*\(.*\)/,
               getValue(str, targetElement) {
                   const offset = targetElement.offsetLeft;
                   let params;
                   if(str.match(/getOffsetFromLeftEdge\((.*?)\)/)!==null)
                       params = str.match(/getOffsetFromLeftEdge\((.*?)\)/).map(str=>str.trim());
                   let suffix;
                   let formula;
                   if(params!==undefined && params[1]!==''){
                       params = params[1].replace(/[\"\']/g,'').split(',').map(str=>str.trim());
                       if(params.length>=1)
                           suffix = params[0];
                       if(params.length>=2)
                           formula=params[1];
                   }
                   let result = formula===undefined? offset : eval(offset+formula);
                   result += (suffix===undefined? '':suffix);
                   return result;
               }
           },
           {
               /**
                * getOffsetFromRightEdge
                * 스크린 왼쪽부터 요소의 왼쪽 면까지의 거리 계산
                * param1 : 접미어(단위)
                * param2 : 추가계산식
                */
               functionNm : 'getOffsetFromRightEdge',
               functionRegex : /getOffsetFromRightEdge\s*\(.*\)/,
               getValue(str, targetElement) {
                   const offset = document.body.clientWidth - targetElement.clientWidth - targetElement.offsetLeft;
                   let params;
                   if(str.match(/getOffsetFromRightEdge\((.*?)\)/)!==null)
                       params = str.match(/getOffsetFromRightEdge\((.*?)\)/).map(str=>str.trim());
                   let suffix;
                   let formula;
                   if(params!==undefined && params[1]!==''){
                       params = params[1].replace(/[\"\']/g,'').split(',').map(str=>str.trim());
                       if(params.length>=1)
                           suffix = params[0];
                       if(params.length>=2)
                           formula=params[1];
                   }
                   let result = formula===undefined? offset : eval(offset+formula);
                   result += (suffix===undefined? '':suffix);
                   return result;
               }
           },
           {
               functionNm: 'calcRatioOfScreenHeight',
               functionRegex : /calcRatioOfScreenHeight\s*\(.+\)/,
               getValue(str, targetElement) {
                   let param;
                   if(str.match(/calcRatioOfScreenHeight\((.*?)\)/)!==null)
                       param = parseFloat(str.match(/calcRatioOfScreenHeight\((.*?)\)/)[1]);

                   return _100vh*param;
               }
           }
       ];
   }

   function convertFunctionValue(str, targetElement){
       const declaredFunction = customFunctionList.find(f=>str.match(f.functionRegex));
       return declaredFunction===undefined? str : declaredFunction.getValue(str, targetElement);
   }

   function getBackgroundColor(){
       const bgColorStr = window.getComputedStyle(document.body).getPropertyValue('background-color');
       const bgColorArr = bgColorStr.match(/\d+/g).map(e=>Number(e));
       return {red: bgColorArr[0], green: bgColorArr[1], blue: bgColorArr[2]}
   }

   function adjustBrightnessOfColor(r, g, b, percent){
       return {red: Math.round(r*percent), green: Math.round(g*percent), blue: Math.round(b*percent)};
   }

   function addEventToStars(){
       const emptyStars = [...document.querySelectorAll('#star-points-box>.empty-star')];
       const halfFilledStars = [...document.querySelectorAll('#star-points-box>.half-filled-star')];
       const filledStars = [...document.querySelectorAll('#star-points-box>.filled-star')];
       const allStars = [...emptyStars, ...halfFilledStars, ...filledStars];

       allStars.forEach(star=>star.addEventListener('click', event=>{
           let idx = emptyStars.findIndex(e=>e===star);
           idx = idx===-1? halfFilledStars.findIndex(e=>e===star) : idx;
           idx = idx===-1? filledStars.findIndex(e=>e===star) : idx;

           let isHalf = false;
           isHalf = event.offsetX <= star.clientWidth / 2;

           for(let i=0; i<emptyStars.length; i++){
               emptyStars[i].classList.add('display-none');
               halfFilledStars[i].classList.add('display-none');
               filledStars[i].classList.remove('display-none');

               if(i>=idx){
                   filledStars[i].classList.add('display-none');
                   if(i===idx){
                       if(isHalf)
                           halfFilledStars[i].classList.remove('display-none');
                       else
                           filledStars[i].classList.remove('display-none');
                   }
                   else
                       emptyStars[i].classList.remove('display-none');
               }
           }

           const form = document.querySelector('form.visibility-hidden');
           if(form.classList.contains('visibility-hidden'))
            document.querySelector('form.visibility-hidden').classList.remove('visibility-hidden');
       }));
   }

   function addEventToTextArea(){
       const btn = document.querySelector('form button[type="submit"]');
       document.querySelector('#userComment').addEventListener('keyup',e=>{
           if(e.target.value.trim()==='')
               btn.disabled = true;
           else if(btn.disabled)
               btn.disabled = false;
       })
   }

    /**
     * 이미지슬라이드 넓이에 맞게 이미지를 반복 생성하는 함수
     *
     * @param selector          css 선택자 구문
     * @param isRandomSlides    이미지 생성의 random 출력 여부
     */
   function createImageSlides(selector='.image-slide-zone', isRandomSlides=true){
       let imageSlide = document.querySelector(selector);
       if (imageSlide!==null) {
           let images = imageSlide.querySelectorAll('img');
           if(images.length>0) {
               const targetWidth = imageSlide.clientWidth;
               let sumWidth = 0;
               let lastImgWidth;
               let widths = [];
               const documentFragment = new DocumentFragment();

               // 이미지를 이어붙인 넓이가 이미지슬라이드 넓이를 초과할 때까지 반복
               while (sumWidth <= targetWidth) {
                   let idxArr = [];

                   for (let i = 0; i < images.length; i++)
                       idxArr.push(i);

                   if (isRandomSlides) //랜덤여부가 설정된 경우 배열을 랜덤하게 mix
                       idxArr = mixArr(idxArr);

                   //이미지별 width 계산이 안된 최초에만 실행
                   if(widths.length===0) {
                       images = [...images];
                       //이미지별 width 계산
                       widths = images.map(img => img.clientWidth);
                   }
                   //이미지 clone배열 생성
                   images = images.map(img => img.cloneNode(true));

                   let i = 0;
                   while (i < idxArr.length && sumWidth <= targetWidth) {
                       let idx = idxArr[i++];
                       documentFragment.appendChild(images[idx]);
                       lastImgWidth = widths[idx];
                       sumWidth += lastImgWidth;
                   }
               }
               //마지막 이미지를 첫번째에 복사 삽입
               const lastImg = documentFragment.childNodes[documentFragment.childNodes.length-1].cloneNode(true);
               documentFragment.insertBefore(lastImg, documentFragment.querySelector('img'));

               imageSlide.innerHTML = '';
               imageSlide.appendChild(documentFragment);
               imageSlide.style.width=`${sumWidth+lastImgWidth}px`;
           }
       }
   }

    /**
     * 배열요소를 random하게 뒤섞는 함수
     *
     * @param array     배열
     * @returns {*[]}   random하게 뒤섞인 배열
     */
   function mixArr(array){
       let result=[];
       let tmp=[...array];
       while(result.length!==array.length){
           let randomIdx = Math.floor(Math.random()*tmp.length);
           result.push(tmp[randomIdx]);
           tmp.splice(randomIdx,1);
       }
       return result;
   }

    const imageSlides = [...document.querySelectorAll('.image-slide-inner-zone')];
    imageSlides.forEach(slide=>{
        let triggerHook=0.8;
        if(slide.dataset.animationInfos.match(/trigger-hook\s*:.*?[\d\.]+/)!=null)
            triggerHook = parseFloat(slide.dataset.animationInfos.match(/trigger-hook\s*:.*?([\d\.]+)/)[1]);
        slide.dataset.animationInfos += `, scroll-duration: '${_100vh}'`;
    })
    return {createImageSlides, loadElementsToAnimate, addEventToStars, addEventToTextArea, setElemsAniOnLoad, setElemsAniOnScroll, _100vh};
}());

const EventProcessor = (function (){
    let alreadyShowed = false;
    let orgTranslateY;
    let orgTranslateX;
    let transformedElem = document.body;
    let _isAutoBottomStyle=false;
    let _isLinkToInsurance;
    let didCallback=false;

    let surveyResult;

    let insuranceUrl;
    let insuranceImg;
    let insuranceName;
    let insuranceExplain;
    let serviceUrl;
    let serviceImg;
    let serviceName;
    let serviceExplain;

    let _contentsId;
    let _userKey;
    let _bannerHistorySeq;

    function initSetting(params){
        _contentsId = params.contentsId;
        //user key 생성
        createUserKey();
        //css 전역변수 설정
        setPropertiesForCss();
        //피드백라디오(좋아요/싫어요) 기본이벤트처리
        initSettingForReviewRadio(params.contentsId);
        //gnb(헤더) 자동 숨기기 설정
        setAutoHideGnb();
        //bottom-sheet 추천상품정보 설정
        const linkInfoForInsurance = params.linkInfoForInsurance;
        insuranceUrl = linkInfoForInsurance.url;
        insuranceImg = linkInfoForInsurance.imgUrl;
        insuranceName = linkInfoForInsurance.name;
        insuranceExplain = linkInfoForInsurance.explain;

        const linkInfoForService = params.linkInfoForService;
        serviceUrl = linkInfoForService.url;
        serviceImg = linkInfoForService.imgUrl;
        serviceName = linkInfoForService.name;
        serviceExplain = linkInfoForService.explain;

        //Bottom-sheet 생성
        createBottomSheet();
        // bottom-sheet 등장 자동/수동 설정
        if(isAutoBottomStyle())
            setAutoBottomSheetEvent();
        else
            setBottomSheetEvent();
    }

    function setAutoHideGnb(){
        let isShowing = true;
        let prevScrollY = 0;
        let firstScrollY;
        let prevScrolledDown = false;
        const scrollYValue = 100;
        const gnb = document.querySelector('nav');
        if(gnb===null)
            return;

        window.addEventListener('scroll',e=>{
            let isScrollingDown = window.scrollY>prevScrollY;
            if(!isScrollingDown && gnb.classList.contains('hide') && window.scrollY===0)
                gnb.classList.remove('hide');
            else if(isShowing && isScrollingDown || !isShowing && !isScrollingDown){
                let hasChangedDirection = isScrollingDown^prevScrolledDown;
                prevScrolledDown = isScrollingDown;
                if(hasChangedDirection){
                    firstScrollY = window.scrollY;
                    return;
                }
                if(Math.abs(window.scrollY-firstScrollY)>scrollYValue){
                    isShowing = !isShowing;
                    gnb.classList.toggle('hide');
                }
            }
            prevScrollY = window.scrollY;
        })
    }
    function createUserKey(){
        let userKey = getLocalStorage('user-key', true);
        if(userKey===null && _contentsId!==undefined) {
            const currDate = new Date();
            userKey = currDate.toLocaleDateString("ko-KR").replace(/[\s\.]/g,'');
            userKey += currDate.toLocaleTimeString("en-GB").replace(/[\:]/g,'');
            userKey += '-';
            userKey += Date.now().toString(36);
        }
        if(userKey!==null){
            setLocalStorage('user-key',userKey, 14, true);
        }
    }
    function setGoNextAndFirstBtn(callbackForNext, callbackForPrev){
        const goNextBtn = document.querySelector('#goNextBtn');
        const goFirstBtn = document.querySelector('#goFirstBtn');

        if(goNextBtn!==null){
            goNextBtn.addEventListener('click',e=>{
                togglePageContents();
                callbackForNext();
                customerJourney.setElemsAniOnScroll();
                document.documentElement.classList.remove('overflow-y-hidden');
            });
        }
        if(goFirstBtn!==null){
            goFirstBtn.addEventListener('click',e=>{
                const gnb = document.querySelector('nav');
                if(gnb!==null)
                    gnb.classList.remove('hide');
                togglePageContents();

                if(callbackForPrev!==null)
                    callbackForPrev();
                document.documentElement.classList.add('overflow-y-hidden');
            });
        }
    }
    function togglePageContents(){
        [...document.querySelectorAll('[data-is-showing=true]')].forEach(elem=>elem.dataset.isShowing='processing');
        [...document.querySelectorAll('[data-is-showing=false]')].forEach(elem=>elem.dataset.isShowing='true');
        [...document.querySelectorAll('[data-is-showing=processing]')].forEach(elem=>elem.dataset.isShowing='false');
    }

    function postBannerExposeInfo() {
        const url = `/journey/form/banner-expose`;
        const sendData = {
            kywr_name:'테스트키워드'
            , ctts_num: _contentsId // 콘텐츠아이디
            , expr_lctn: _isAutoBottomStyle ? '001':'002' // 자동 : 수동
            , expr_cmdt: _isLinkToInsurance ? '001':'002' // 보험 : 부가서비스
            , expr_cmdt_name: getLinkInfos().linkName
            , expr_link: getLinkInfos().linkUrl
        };
        postData(url, sendData, result=>{
            console.log(result);
            _bannerHistorySeq = result.hstr_srmb;
        })
    }

    function postBannerClickInfo(href) {
        const url = `/journey/form/banner-visit`;
        const sendData = {
            kywr_name:'테스트키워드'
            , ctts_num: _contentsId // 콘텐츠아이디
            , hstr_srmb: _bannerHistorySeq // 배너이력순번
            , expr_lctn: _isAutoBottomStyle ? '001':'002' // 자동 : 수동
            , expr_cmdt: _isLinkToInsurance ? '001':'002' // 보험 : 부가서비스
            , expr_cmdt_name: getLinkInfos().linkName
            , expr_link: getLinkInfos().linkUrl
        };
        postData(url, sendData, result=>{
            console.log(result);
            window.location.href=href;
        })
    }

    function setAutoBottomSheetEvent(){
        const feedbackArea = document.querySelector('#feedback-area');
        if(feedbackArea===null)
            return;

        let targetScrollY = feedbackArea.offsetTop;
        let prevScrollY=0;

        const handler = e =>{
            const hasScrolledDown = window.scrollY>prevScrollY;
            prevScrollY = window.scrollY;
            if(hasScrolledDown){
                if(targetScrollY===0)
                    targetScrollY = feedbackArea.offsetTop;
                if(customerJourney._100vh*0.5 + window.scrollY > targetScrollY){
                    scrollToEndOfFeedbackArea();    // 화면을 피드백영역 하단으로 자동 스크롤
                    showBottomSheet(postBannerExposeInfo); // 바텀시트 등장
                    //한번만 동작하도록 이벤츠해제
                    window.removeEventListener('scroll',handler);
                }
            }
        }
        window.addEventListener('scroll',handler);
    }
    function scrollToEndOfFeedbackArea(){
        const feedbackArea = document.querySelector('#feedback-area');
        const scrollValue = feedbackArea.offsetHeight - (customerJourney._100vh - (feedbackArea.offsetTop-window.scrollY))
                            -60;

        document.body.style.transition=`margin 0.4s`;
        document.body.style.marginTop=`-${scrollValue}px`;
    }

    function getLinkInfos(){
        let linkUrl, linkImg, linkName, linkExplain;
        if(isLinkToInsurance()) {
            linkUrl = insuranceUrl;
            linkImg = insuranceImg;
            linkName = insuranceName;
            linkExplain = insuranceExplain;
        }
        else {
            linkUrl = serviceUrl;
            linkImg = serviceImg;
            linkName = serviceName;
            linkExplain = serviceExplain;
        }
        return {linkUrl, linkImg, linkName, linkExplain};
    }

    function handleScrollLock() {
        document.documentElement.classList.toggle('overflow-y-hidden');
        document.body.classList.toggle('overflow-y-hidden');
        // document.querySelector('.main-wrapper').classList.toggle('overflow-y-hidden');
    }

    function createDimmedScreen(){
        const dimmed = document.createElement('div');
        dimmed.setAttribute('class', 'dimmed');
        document.body.appendChild(dimmed);
    }

    function createBottomSheet() {
        const linkInfos = getLinkInfos(); //링크정보 불러오기

        const bottomSheet = document.createElement('div');
        bottomSheet.setAttribute('class', 'bottom-sheet fc-1 hide');

        const headline = document.createElement('div');
        headline.setAttribute('class', 'headline');

        const titleMsg = document.createElement('h4');
        titleMsg.setAttribute('class', 'fw-700');
        titleMsg.textContent = '이런 상품 어떠세요?'

        const closeBtn = document.createElement('a');

        const closeBtnMsg = document.createElement('span');
        closeBtnMsg.style.display='none';
        closeBtnMsg.textContent = '닫기';

        const closeBtnImg = document.createElement('img');
        closeBtnImg.setAttribute('src', '/resources/v1/img/ico-30-svg-close-b.svg');

        const recommendBox = document.createElement('div');
        recommendBox.setAttribute('class', 'recommend-product text-align-center');

        const recommendImg = document.createElement('img');
        recommendImg.setAttribute('src', linkInfos.linkImg);
        recommendImg.setAttribute('width', '80');
        recommendImg.setAttribute('class', 'mt-10');

        const recommendName = document.createElement('h4');
        recommendName.setAttribute('class', 'mt-10 fw-700');
        recommendName.textContent = linkInfos.linkName;

        const recommendExplain = document.createElement('p');
        recommendExplain.setAttribute('class', 'mt-10 mb-20 fs-7 fc-3');
        recommendExplain.textContent = linkInfos.linkExplain;

        const kyoboLink = document.createElement('a');
        kyoboLink.setAttribute('href', linkInfos.linkUrl);
        kyoboLink.setAttribute('class', 'text-align-center fw-700 fs-6 mt-10 fc-2')
        kyoboLink.textContent = '더 알아보기';
        kyoboLink.addEventListener('click',e=>{
            e.preventDefault();
            postBannerClickInfo(linkInfos.linkUrl);
        })

        const arrowImg = document.createElement('img');
        arrowImg.setAttribute('src', '/resources/v1/img/ico-12-arrow-g.svg');

        //bottomsheet 타이틀 생성
        closeBtn.appendChild(closeBtnMsg);
        closeBtn.appendChild(closeBtnImg);
        closeBtn.addEventListener('click', e => {
            e.preventDefault();
            closeBottomSheet();
        })
        headline.appendChild(titleMsg);
        headline.appendChild(closeBtn);

        //상품추천내용 생성
        recommendBox.appendChild(recommendImg);
        recommendBox.appendChild(recommendName);
        recommendBox.appendChild(recommendExplain);

        //더 알아보기
        kyoboLink.appendChild(arrowImg);

        //bottom sheet
        bottomSheet.appendChild(headline);
        bottomSheet.appendChild(recommendBox);
        bottomSheet.appendChild(kyoboLink);
        bottomSheet.addEventListener('transitionend', () => {
            //scroll 잠그기
            handleScrollLock();
        });

        document.body.appendChild(bottomSheet);
    }

    function showBottomSheet(callBackFunc) {
        const bottomSheet = document.querySelector(".bottom-sheet");
        if(bottomSheet===null || !bottomSheet.classList.contains('hide'))
            return;

        //dimmed screen 생성
        createDimmedScreen();
        //bottom-sheet 숨기기 해제
        window.setTimeout(()=>bottomSheet.classList.toggle('hide')
            ,100);

        //callback function
        //tracking은 한번만 수행
        if(!didCallback) {
            callBackFunc();
            didCallback=true;
        }
    }
    function closeBottomSheet(){
        if(document.querySelector(".bottom-sheet")===null)
            return;

        // 자동스크롤(TranslateY)된 Body(배경) 요소 복구
        // transformedElem.style.transform=`translate(${orgTranslateX}px, ${orgTranslateY}px)`;
        document.body.style.marginTop='';

        const bottomSheet = document.querySelector(".bottom-sheet");
        bottomSheet.addEventListener('transitionend',()=> {
            if(bottomSheet.classList.contains('hide'))
                document.querySelector('.dimmed').remove();
        });
        bottomSheet.classList.toggle('hide');
    }

    function isLinkToInsurance() {
        if(_isLinkToInsurance===undefined)
            _isLinkToInsurance = Math.floor(Math.random()*10)<5;
        return _isLinkToInsurance;
    }

    function isAutoBottomStyle() {
        _isAutoBottomStyle = Math.floor(Math.random()*10)<5;
        return _isAutoBottomStyle;
    }

    function setBottomSheetEvent() {
        if(document.querySelector('input#feedback-radio-01')===null)
            return;
        document.querySelector('input#feedback-radio-01').addEventListener(
            'change', ()=>showBottomSheet(postBannerExposeInfo)
        );
    }

    function getSurveyResult(contentsId){
        let result;
        console.log('get survey result==================');
        console.log('contentsId : ', contentsId);
        result = {};
        result.counts = [55, 45, 15];
        console.log('contentsId : ', contentsId);

        return result.counts;
    }

    function getResultOfSurvey(contentsId, callback){
        // const url = `http://localhost:8080/v1/contents/7D_003.html?contentsId?=${contentsId}`;
        const url = `/journey/form/contents-survey?ctts_num=${contentsId}`;
        const testData = {arr:[55,45]}
        fetch(url)
            .then(res=>res.json())
            .then(json=>callback(json))
            .catch(()=>callback(testData))
    }

    function postData(url,data, callback){
        let options = {
            method: 'POST', // *GET, POST, PUT, DELETE 등
            mode: 'cors', // no-cors, *cors, same-origin
            cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
            credentials: 'same-origin', // include, *same-origin, omit
            headers: {
                'Content-Type': 'application/json',
                // 'Content-Type': 'application/x-www-form-urlencoded',
            },
            redirect: 'follow', // manual, *follow, error
            referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
            body: JSON.stringify(data), // body의 데이터 유형은 반드시 "Content-Type" 헤더와 일치해야 함
        };

        fetch(url, options)
            .then(res=>res.json())
            .then(result=>callback(result))
            .catch(error=>callback(error));
    }

    function postReview(value){
        const url = `/journey/form/contents-review`;
        const sendData = {
            kywr_name:'테스트키워드'
            , ctts_num: _contentsId
            , ctts_vltn_wrth: value
        };
        postData(url, sendData, result=>{console.log(result)})
    }

    function removeLocalStorage(key, isGlobal=false){
        let localData = localStorage.getItem(isGlobal? key:_contentsId);
        if (localData===null)
            return;
        localData = JSON.parse(localData);
        localData = isGlobal? localData : localData[key];

        if(localData!==undefined)
            delete localData;

        localStorage.setItem(isGlobal? key:_contentsId, JSON.stringify(localData));
    }

    function setLocalStorage(key, value, period, isGlobal=false) {
        const expiry = new Date(Date.now() + (period * 24 * 3600 * 1000))
            .toLocaleDateString().replace(/\s/g, '');
        const inputData = {
            value: value,
            expiry: expiry
        };
        let localData;
        if(isGlobal){
            localData = inputData;
        }else {
            localData = localStorage.getItem(_contentsId);
            localData = (localData === null ? {} : JSON.parse(localData));
            localData[key] = inputData;
        }
        localStorage.setItem(isGlobal? key:_contentsId, JSON.stringify(localData));
    }

    function getLocalStorage(key,isGlobal=false) {
        let localData = localStorage.getItem(isGlobal? key:_contentsId);
        if(localData===null)
            return null;
        localData = JSON.parse(localData);
        localData = isGlobal? localData : localData[key];
        const currDate = new Date().toLocaleDateString().replace(/\s/g,'');

        if(localData===undefined || currDate>=localData.expiry) {
            removeLocalStorage(key);
            return null;
        }
        return localData.value;
    }

    function initSettingForReviewRadio(contentsId, radios){
        _contentsId = contentsId;
        radios = radios||document.querySelectorAll('input[name="feedback-radio"][type="radio"]');
        if(radios.length===0)
            return;

        const localCheckedValue = getLocalStorage('feedback-value');
        radios.forEach(radio=> {
            radio.addEventListener('change', e => {
                postReview(e.target.value);
                setLocalStorage('feedback-value', e.target.value, 14);//2주만 보관
            });
            if(radio.value===localCheckedValue)
                radio.checked = true;
        });
    }

    const setPropertiesForCss = function (){
        const _setPropertiesForCss = () => {
            document.documentElement.style.setProperty('--vscrollwidth', `${window.innerWidth - document.documentElement.clientWidth}px`);
            document.documentElement.style.setProperty('--1vw', `${Math.round(document.documentElement.clientWidth / 100 * 10) / 10}px`);
            document.documentElement.style.setProperty('--100vh-inner', `${document.documentElement.clientHeight}px`);
        }
        _setPropertiesForCss();
        window.addEventListener('resize',_setPropertiesForCss);
    }
    return {setAutoHideGnb, setGoNextAndFirstBtn, isAutoBottomStyle, setAutoBottomSheetEvent
        , setBottomSheetEvent, setPropertiesForCss, getResultOfSurvey, togglePageContents
        , initSetting}
})();