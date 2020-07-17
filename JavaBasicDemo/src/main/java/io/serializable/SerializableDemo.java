package io.serializable;

import io.serializable.entity.Person;
import org.junit.Test;

import java.io.FileOutputStream;
import java.io.ObjectOutputStream;

/**
 * @description 序列和反序列化demo
 * @company com.yinhai
 * @author zhoucw
 * @date 2020-07-15 23:48
 * @version v1.0
 */
public class SerializableDemo {

    @Test
    public void serializableObject() throws Exception {
        Person person = new Person();
        person.setName("ZeroJoe");
        person.setSex("female");
        ObjectOutputStream objectOutputStream = new ObjectOutputStream(new FileOutputStream("person"));
        objectOutputStream.writeObject(person);
        objectOutputStream.close();
    }
}
