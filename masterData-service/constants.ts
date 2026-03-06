import { HttpStatus } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';

interface Response<T> {
    status: HttpStatus;
    data: T;
}

class Metadata {
    @ApiPropertyOptional()
    pageNumber?: number;

    @ApiPropertyOptional()
    limit?: number;

    @ApiPropertyOptional()
    totalCount?: number;
}

 enum LogType {
    INFO = 'info',
    ERROR = 'error',
}

const CURRENT_DATE = new Date();


const DATA_STATUS = {
    ACTIVE: 'A',
    PENDING: 'P',
    INACTIVE: 'I',
    DELETED: 'X',
};
const REC_STATUS = {
    ACTIVE: "A",
    PENDING: "P",
    INACTIVE: "I",
    DELETED: "X",
};

const REC_SEQ = {
    DEFAULT_RECORD: 0,
    FIRST_RECORD: 1,
};

const ACTIVE_CONDITION = {
    recSeq: REC_SEQ.DEFAULT_RECORD,
    recStatus: REC_STATUS.ACTIVE,
    dataStatus: DATA_STATUS.ACTIVE,
};

const ADMIN = 'b87e7c4a-33af-4c62-a8ab-96a2de431c91';

const AVATAR = 'AVATAR';

const DB_NAME = 'public';

const TABLE_NAMES = {
    MASTER_DATA: 'MasterData',
    USERS: 'Users',
    LISTS: 'Lists',
    INTEGRATIONS: 'Integrations',
    LIST_INTEGRATION_MAPPING: 'ListIntegrationMapping',
    ITEMS: 'Items',
    ITEM_CATEGORIES: 'ItemCategories',
}

const RESPONSE_STATUS = {
    USER: 'User ',
    MASTER_DATA: 'Master Data ',
    LIST: 'List ',
    INTEGRATION: 'Integration ',
    LIST_INTEGRATION_MAPPING: 'List Integration Mapping ',
    ITEM: 'Item ',
    ITEM_CATEGORY: 'Item Category ',
    SUCCESS: {
        CREATE: 'Created successfully',
        UPDATE: 'Updated successfully',
        DELETE: 'Deleted successfully',
        FIND_ALL: 'Fetched All successfully',
        FIND_UNIQUE: 'Fetched successfully',
    },
    ERROR: {
        BAD_REQUEST: 'Bad Request ',
        INTERNAL_SERVER_ERROR: 'Internal Server Error ',
        ERROR_OCCURRED: 'Error Occurred',  
        NOT_FOUND: 'Not Found',     
        ALREADY_EXISTS: 'Already Exists',
    },
}
enum MethodNames {
    create = 'create',
    update = 'update',
    delete = 'delete',
    findAll = 'findAll',
    findUnique = 'findUnique',
    updateStatus = 'updateStatus',
    signUp = 'signup',
    signIn = 'signin',
    refreshToken = 'refreshToken',
    logout = 'logout',
}

export { CURRENT_DATE, DATA_STATUS, REC_STATUS, REC_SEQ, ACTIVE_CONDITION, ADMIN, RESPONSE_STATUS, DB_NAME, TABLE_NAMES, MethodNames, LogType, Response, Metadata, AVATAR };
