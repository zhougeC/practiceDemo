package io.serializable.entity;

import java.io.Serializable;

/**
 * @description 序列化和反序列化测试实体
 * @company com.yinhai
 * @author zhoucw
 * @date 2020-07-15 23:51
 * @version v1.0
 */
public class Person implements Serializable {
    private final static Long serialVersionUID = 50L;

    /** 姓名 */
    private String name;

    /** 性别 */
    private String sex;

    public String getSex() {
        return sex;
    }

    public void setSex(String sex) {
        this.sex = sex;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
